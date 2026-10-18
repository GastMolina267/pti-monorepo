#!/bin/sh
set -eu
umask 027

# Convertir sin contraseñas en argumentos ni logs; publicar el archivo solo al terminar.
cp /run/mqtt/users /mosquitto/auth/.passwords-new
mosquitto_passwd -U /mosquitto/auth/.passwords-new
cp /run/mqtt/acl /mosquitto/auth/.acl-new
chown root:mosquitto /mosquitto/auth /mosquitto/auth/.passwords-new /mosquitto/auth/.acl-new
chmod 750 /mosquitto/auth
chmod 640 /mosquitto/auth/.passwords-new /mosquitto/auth/.acl-new
mv /mosquitto/auth/.passwords-new /mosquitto/auth/passwords
mv /mosquitto/auth/.acl-new /mosquitto/auth/acl
