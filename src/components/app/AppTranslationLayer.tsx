"use client"

import { useEffect } from "react"
import type { AppLocale } from "@/lib/app-locale"

type TranslationPattern = { source: string; value: string }
type TranslationCatalog = {
  APP_UI_COPY: Record<string, string>
  APP_UI_PATTERNS: readonly TranslationPattern[]
}

const TRANSLATABLE_ATTRIBUTES = ["placeholder", "title", "aria-label", "alt"] as const
const CYRILLIC = /[А-Яа-яЁё]/
const TEXT_SOURCES = new WeakMap<Text, string>()
const ATTRIBUTE_SOURCES = new WeakMap<Element, Map<string, string>>()
const COMPILED_PATTERNS = new WeakMap<TranslationCatalog, Array<TranslationPattern & { regex: RegExp }>>()

function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function compilePattern(source: string) {
  let cursor = 0
  let expression = "^"
  const token = /\{(\d+)\}/g
  let match: RegExpExecArray | null
  while ((match = token.exec(source)) !== null) {
    expression += escapeRegex(source.slice(cursor, match.index))
    expression += "(.*?)"
    cursor = match.index + match[0].length
  }
  expression += `${escapeRegex(source.slice(cursor))}$`
  return new RegExp(expression, "u")
}

function patternsFor(catalog: TranslationCatalog) {
  const cached = COMPILED_PATTERNS.get(catalog)
  if (cached) return cached
  const compiled = catalog.APP_UI_PATTERNS.map((pattern) => ({
    ...pattern,
    regex: compilePattern(pattern.source),
  }))
  COMPILED_PATTERNS.set(catalog, compiled)
  return compiled
}

function translateCore(value: string, catalog: TranslationCatalog | null): string {
  if (!catalog) return value
  const direct = catalog.APP_UI_COPY[value]
  if (direct) return direct

  for (const pattern of patternsFor(catalog)) {
    const match = value.match(pattern.regex)
    if (!match) continue
    return pattern.value.replace(
      /\{(\d+)\}/g,
      (_, index: string) => translateCore(match[Number(index) + 1] ?? "", catalog),
    )
  }

  // React often splits one sentence into several text nodes around dynamic values. Translating
  // known Russian words inside such nodes keeps those sentences complete without touching
  // unknown club, staff or client data.
  const isFormattedDate = /^\d{1,2}\s+[А-Яа-яЁё]{3,}\.?(?:\s+\d{4}(?:\s+[А-Яа-яЁё.]+)?)?$/u.test(value)
  if (CYRILLIC.test(value) && isFormattedDate) {
    const translatedFragments = value.replace(
      /[А-Яа-яЁё]+(?:-[А-Яа-яЁё]+)*/gu,
      (fragment) => (
        fragment === "г"
          ? catalog.APP_UI_COPY.__DATE_YEAR__ ?? fragment
          : catalog.APP_UI_COPY[fragment] ?? fragment
      ),
    )
    if (translatedFragments !== value) return translatedFragments
  }
  return value
}

function translateValue(value: string, catalog: TranslationCatalog | null) {
  if (!catalog) return value
  const normalized = normalize(value)
  if (!normalized) return value
  const translated = translateCore(normalized, catalog)
  if (translated === normalized) return value
  const leading = value.match(/^\s*/)?.[0] ?? ""
  const trailing = value.match(/\s*$/)?.[0] ?? ""
  return `${leading}${translated}${trailing}`
}

function shouldSkip(node: Node) {
  const element = node instanceof Element ? node : node.parentElement
  if (!element) return false
  return Boolean(element.closest("[data-app-no-translate], script, style, code, pre"))
}

function applyText(text: Text, catalog: TranslationCatalog | null) {
  if (shouldSkip(text)) return
  const current = text.data
  const saved = TEXT_SOURCES.get(text)
  const expected = saved ? translateValue(saved, catalog) : null
  if (saved && current === expected) return

  if (!saved && CYRILLIC.test(current) && translateValue(current, catalog) !== current) {
    TEXT_SOURCES.set(text, current)
  } else if (saved && CYRILLIC.test(current) && current !== expected) {
    TEXT_SOURCES.set(text, current)
  }

  const source = TEXT_SOURCES.get(text)
  if (!source) return
  const next = translateValue(source, catalog)
  if (text.data !== next) text.data = next
}

function applyAttributes(element: Element, catalog: TranslationCatalog | null) {
  if (shouldSkip(element)) return
  let sources = ATTRIBUTE_SOURCES.get(element)

  for (const attribute of TRANSLATABLE_ATTRIBUTES) {
    const current = element.getAttribute(attribute)
    if (!current) continue
    const saved = sources?.get(attribute)
    const expected = saved ? translateValue(saved, catalog) : null
    if (saved && current === expected) continue

    if (!saved && CYRILLIC.test(current) && translateValue(current, catalog) !== current) {
      sources ??= new Map()
      sources.set(attribute, current)
      ATTRIBUTE_SOURCES.set(element, sources)
    } else if (saved && CYRILLIC.test(current) && current !== expected) {
      sources?.set(attribute, current)
    }

    const source = sources?.get(attribute)
    if (!source) continue
    const next = translateValue(source, catalog)
    if (current !== next) element.setAttribute(attribute, next)
  }
}

function applyTree(root: Node, catalog: TranslationCatalog | null) {
  if (root instanceof Text) {
    applyText(root, catalog)
    return
  }
  if (!(root instanceof Element) && !(root instanceof DocumentFragment)) return
  if (root instanceof Element) applyAttributes(root, catalog)

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    if (node instanceof Text) applyText(node, catalog)
    else if (node instanceof Element) applyAttributes(node, catalog)
    node = walker.nextNode()
  }
}

async function loadCatalog(locale: AppLocale): Promise<TranslationCatalog | null> {
  if (locale === "en") return import("@/lib/app-ui-translations.en.generated")
  if (locale === "uz") return import("@/lib/app-ui-translations.uz.generated")
  return null
}

/**
 * Translates only copy extracted from the CRM source tree. Unknown text is left intact, so club,
 * staff and client data are never sent anywhere or treated as interface copy.
 */
export function AppTranslationLayer({ locale }: { locale: AppLocale }) {
  useEffect(() => {
    let active = true
    let observer: MutationObserver | null = null

    void loadCatalog(locale).then((catalog) => {
      if (!active) return
      document.documentElement.lang = locale
      applyTree(document.body, catalog)
      document.documentElement.dataset.appLocaleReady = locale

      observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === "childList") {
            mutation.addedNodes.forEach((node) => applyTree(node, catalog))
          } else if (mutation.type === "characterData" && mutation.target instanceof Text) {
            applyText(mutation.target, catalog)
          } else if (mutation.type === "attributes" && mutation.target instanceof Element) {
            applyAttributes(mutation.target, catalog)
          }
        }
      })
      observer.observe(document.body, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: [...TRANSLATABLE_ATTRIBUTES],
      })
    })

    return () => {
      active = false
      observer?.disconnect()
    }
  }, [locale])

  return null
}
