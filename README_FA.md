# سیستم آنلاین جایزه واتساپی تاج الفخامة

## نصب روی ویندوز

داخل پوشه پروژه CMD باز کن:

```bash
npm install
npm start
```

بعد باز کن:

```text
http://localhost:3000
```

## تنظیم شماره واتساپ مغازه

قبل از اجرا:

```bash
set SHOP_WHATSAPP=965XXXXXXXX
npm start
```

یا داخل فایل `server.js` این خط را عوض کن:

```js
const SHOP_WHATSAPP = process.env.SHOP_WHATSAPP || "965XXXXXXXX";
```

## تغییر جایزه‌ها

فقط فایل `prizes.json` را تغییر بده.

`weight` هرچی بیشتر باشد احتمال جایزه بیشتر است.

## فایل ذخیره اطلاعات

اطلاعات مشتری‌ها و کدها اینجا ذخیره می‌شود:

```text
data/claims.json
```
