# ساخت فایل EXE - HAZOP Analysis Tool

## پیش‌نیازها

1. **Python 3.8+** و **Node.js 16+** نصب باشند.
2. وابستگی‌ها:

```bash
pip install -r requirements.txt
pip install -r requirements-build.txt
cd frontend
npm install
cd ..
```

## مراحل ساخت EXE

```bash
python build_exe.py
```

اسکریپت به‌صورت خودکار:
1. فرانت‌اند React را build می‌کند (`npm run build`)
2. فایل EXE را با PyInstaller می‌سازد

## خروجی

پوشه `dist/HAZOP-Analysis-Tool/` ایجاد می‌شود که شامل:
- `HAZOP-Analysis-Tool.exe` – فایل اجرایی اصلی
- فایل‌ها و کتابخانه‌های مورد نیاز

**نکته:** کل پوشه `dist/HAZOP-Analysis-Tool` را برای توزیع کپی کنید. پوشه `data` در کنار EXE به‌صورت خودکار ایجاد می‌شود.

## پورت‌ها (بدون تغییر)

- Backend (Flask): **5000**
- Frontend: **3000**

## ویژگی‌ها

- پنجره بومی دسکتاپ با pywebview
- بدون تغییر تنظیمات و پورت‌های پروژه
- پوشه `data` در کنار EXE برای ذخیره داده‌ها
