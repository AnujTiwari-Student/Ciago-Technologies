# Custom Frappe/ERPNext image with HRMS app baked in
# Based on official frappe/erpnext:v15.118.3
#
# Build: docker build -t frappe-erpnext-hrms:v15 docker/frappe/
#
# This ensures HRMS survives container recreation (docker compose down/up)
FROM frappe/erpnext:v15.118.3

USER frappe
WORKDIR /home/frappe/frappe-bench

RUN bench get-app --branch version-15 hrms && bench build --app hrms
