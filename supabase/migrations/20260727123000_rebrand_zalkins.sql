-- User-facing plan copy follows the Zalkins rebrand.
-- Internal identifiers, cookies, integrations, and historical migration names stay unchanged.
update public.plans
set
  description = replace(description, 'FitCRM', 'Zalkins'),
  short_description = replace(short_description, 'FitCRM', 'Zalkins'),
  landing_subtitle = replace(landing_subtitle, 'FitCRM', 'Zalkins'),
  landing_cta = replace(landing_cta, 'FitCRM', 'Zalkins')
where
  description like '%FitCRM%'
  or short_description like '%FitCRM%'
  or landing_subtitle like '%FitCRM%'
  or landing_cta like '%FitCRM%';
