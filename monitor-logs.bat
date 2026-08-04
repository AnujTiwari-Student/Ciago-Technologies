@echo off
echo ============================================
echo Monitoring Frappe Sync Logs
echo ============================================
echo.
echo Watching for:
echo - [frappe-job-sync] messages
echo - [frappe-applicant-sync] messages
echo - [apply-frappe-applicant] messages
echo.
echo Press Ctrl+C to stop monitoring
echo ============================================
echo.

powershell -Command "Get-Content 'C:\Users\anuja\AppData\Local\Temp\claude\C--Ciago-Spark\9a75a655-d966-4f26-bbc3-409acdcb5884\tasks\bcbmti1dx.output' -Wait -Tail 50 | Where-Object { $_ -match 'frappe|Frappe|error|Error|sync|Sync' }"
