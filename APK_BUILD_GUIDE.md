# Building the Burger Calling POS Android APK

## 1. Start the Backend API
1. Run `docker compose up -d` (or point `backend/.env` to Neon PostgreSQL).
2. In `backend/`:
   ```bash
   pip install -r requirements.txt
   alembic upgrade head
   uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```

## 2. Configure Mobile API URL (`mobile/.env`)
- **Android Emulator:** `EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8000/api/v1`
- **Real Android Phone (same Wi-Fi):** `EXPO_PUBLIC_API_BASE_URL=http://<YOUR_PC_IP>:8000/api/v1`
- **Production Render Backend:** `EXPO_PUBLIC_API_BASE_URL=https://api.burgercalling.in/api/v1`

## 3. Build a Standalone `.apk`
### Option A: Cloud APK via Expo EAS (No Android Studio required)
```bash
cd mobile
npm install
npm install -g eas-cli
eas login
eas build -p android --profile preview
```
EAS will output a direct `.apk` download link you can install on any Android phone/tablet.

### Option B: Local APK Build (Android Studio / SDK installed)
```bash
cd mobile
npm install
npx expo prebuild --platform android
cd android
./gradlew assembleRelease
```
Your signed/release APK will be at `mobile/android/app/build/outputs/apk/release/app-release.apk`.

## 4. Hidden Super Admin Access on Mobile
On the Outlet Login screen, **long-press the orange store logo for 1.5 seconds** to open the hidden Central Admin Portal (`superadmin` / `Admin@12345`).
