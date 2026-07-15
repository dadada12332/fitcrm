-- POS-продажа: расширяем методы оплаты (перевод / карта / другое).
alter type payment_provider add value if not exists 'card';
alter type payment_provider add value if not exists 'transfer';
alter type payment_provider add value if not exists 'other';
