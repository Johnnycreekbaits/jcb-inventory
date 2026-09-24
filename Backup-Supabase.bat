@echo off
cd /d "%~dp0"
echo Backing up JCB Supabase to Google Drive...
python backup_supabase.py
pause
