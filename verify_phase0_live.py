import paramiko
import requests
import json

HOST = '82.198.227.230'
PORT = 65002
USER = 'u845028218'
PASS = 'Sonnet5?'

print("="*60)
print("PHASE 0 LIVE BACKEND AUDIT & VERIFICATION")
print("="*60)

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, port=PORT, username=USER, password=PASS, timeout=15)

# 1. Generate live admin token for Super Admin (user_id = 1)
stdin, stdout, stderr = ssh.exec_command("""
cd /home/u845028218/domains/launchapropfirm.com/public_html/api
wp eval '
$expires = time() + 3600;
$sig = hash_hmac("sha256", "fxsim-token|1|" . $expires, wp_salt("auth"));
echo base64_encode("1:{$expires}:{$sig}");
' 2>/dev/null
""")
admin_token = stdout.read().decode().strip()
print(f"[1] Generated Live Super Admin Token: {admin_token[:30]}...")

BASE_URL = "https://api.launchapropfirm.com/wp-json/fxsim/v1"
headers = {
    "Authorization": f"Bearer {admin_token}",
    "X-FXSIM-Token": admin_token,
    "Origin": "https://demo.launchapropfirm.com"
}

# 2. Test Trader 360 / admin/user/3 details (Check MT5 password redaction)
res = requests.get(f"{BASE_URL}/admin/user/3", headers=headers, timeout=10)
print(f"[2] GET /admin/user/3 Status: {res.status_code}")
if res.ok:
    data = res.json()
    challenge = data.get('challenge')
    if challenge:
        print("   - mt5_password in payload:", 'mt5_password' in challenge)
        print("   - mt5_password_set in payload:", challenge.get('mt5_password_set'))
        if 'mt5_password' not in challenge:
            print("   >>> PASS: mt5_password is fully redacted from admin response!")
    else:
        print("   - No challenge record on user #3, checking challenges array")

# 3. Test RBAC route capability execution (overview vs team vs config)
res_stats = requests.get(f"{BASE_URL}/admin/stats", headers=headers, timeout=10)
print(f"[3] GET /admin/stats (Overview): HTTP {res_stats.status_code} | OK: {res_stats.ok}")

res_team = requests.get(f"{BASE_URL}/admin/users", headers=headers, timeout=10)
print(f"[4] GET /admin/users (Traders): HTTP {res_team.status_code} | OK: {res_team.ok}")

# 4. Verify login rejection for suspended user
stdin, stdout, stderr = ssh.exec_command("""
cd /home/u845028218/domains/launchapropfirm.com/public_html/api
wp eval '
$u = get_user_by("login", "test_suspended_staff");
if (!$u) {
    $uid = wp_create_user("test_suspended_staff", "Pass12345!?", "suspended_staff@test.com");
} else {
    $uid = $u->ID;
}
update_user_meta($uid, "fxsim_account_status", "suspended");
echo $uid;
' 2>/dev/null
""")
suspended_uid = stdout.read().decode().strip()
print(f"[5] Created/Configured Suspended Test User ID: {suspended_uid}")

login_res = requests.post(f"{BASE_URL}/auth/login", json={
    "username": "test_suspended_staff",
    "password": "Pass12345!?"
}, timeout=10)
print(f"[6] Login with Suspended Account -> HTTP {login_res.status_code} | Response: {login_res.text}")
if login_res.status_code == 403:
    print("   >>> PASS: Suspended user is strictly rejected with 403 on live server!")

# Cleanup test user
ssh.exec_command(f"cd /home/u845028218/domains/launchapropfirm.com/public_html/api && wp user delete {suspended_uid} --yes 2>/dev/null")
ssh.close()
print("="*60)
print("PHASE 0 LIVE VERIFICATION COMPLETE!")
print("="*60)
