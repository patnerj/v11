import paramiko
import os
import zipfile

bridge_dir = r"d:\Full Propfirm System for antigravity\backend-email-update v10.7.1\protradefx-headless-bridge"
bridge_zip = r"d:\Full Propfirm System for antigravity\backend-email-update v10.7.1\protradefx-headless-bridge.zip"
with zipfile.ZipFile(bridge_zip, 'w', zipfile.ZIP_DEFLATED) as z:
    for root, dirs, files in os.walk(bridge_dir):
        for file in files:
            fp = os.path.join(root, file)
            rp = os.path.relpath(fp, os.path.dirname(bridge_dir))
            z.write(fp, rp.replace('\\', '/'))

system_dir = r"d:\Full Propfirm System for antigravity\backend-email-update v10.7.1\propfirm-system"
system_zip = r"d:\Full Propfirm System for antigravity\backend-email-update v10.7.1\propfirm-system.zip"
with zipfile.ZipFile(system_zip, 'w', zipfile.ZIP_DEFLATED) as z:
    for root, dirs, files in os.walk(system_dir):
        for file in files:
            fp = os.path.join(root, file)
            rp = os.path.relpath(fp, os.path.dirname(system_dir))
            z.write(fp, rp.replace('\\', '/'))

print("Zips repackaged. Connecting SSH...")
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('82.198.227.230', port=65002, username='u845028218', password='Sonnet5?', timeout=30)
sftp = ssh.open_sftp()

print("Uploading bridge_update.zip...")
sftp.put(bridge_zip, '/home/u845028218/bridge_update.zip')
print("Uploading system_update.zip...")
sftp.put(system_zip, '/home/u845028218/system_update.zip')
sftp.close()

script = """
PLUG_DIR="/home/u845028218/domains/launchapropfirm.com/public_html/api/wp-content/plugins"
echo "Deploying to $PLUG_DIR..."
unzip -o -q /home/u845028218/bridge_update.zip -d "$PLUG_DIR/"
unzip -o -q /home/u845028218/system_update.zip -d "$PLUG_DIR/"
rm -f /home/u845028218/bridge_update.zip /home/u845028218/system_update.zip

cd /home/u845028218/domains/launchapropfirm.com/public_html/api
wp transient delete --all 2>/dev/null || true

echo "=== Deployment Status ==="
ls -la "$PLUG_DIR/propfirm-system/includes/class-rest-api.php"
ls -la "$PLUG_DIR/protradefx-headless-bridge/protradefx-headless-bridge.php"
"""

stdin, stdout, stderr = ssh.exec_command(script)
print("STDOUT:\n" + stdout.read().decode())
print("STDERR:\n" + stderr.read().decode())
ssh.close()
print("Deployment completed!")
