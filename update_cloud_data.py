import os.path
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# === CONFIGURACIÓN ===
SPREADSHEET_ID = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'  # Cambia esto por tu ID de hoja
SCOPES = ["https://www.googleapis.com/auth/drive.readonly", "https://www.googleapis.com/auth/spreadsheets"]
CUENTA_ACTUAL = "tu-correo@gmail.com" # Recuerda cambiar esto

# ==============================================================================
# VERSIÓN 2.0 DE LA FUNCIÓN: ¡EL DETECTIVE TENAZ!
# Sigue la ruta de carpetas hasta el final.
# ==============================================================================
def get_full_path(file_id, all_files_map):
    """Reconstruye la ruta completa de un archivo o carpeta de forma recursiva."""
    if file_id not in all_files_map:
        return "" # Si el archivo no está en nuestro mapa, no tiene ruta
    
    item = all_files_map[file_id]
    
    # Si el archivo no tiene 'parents', está en la raíz "Mi unidad"
    if 'parents' not in item:
        return "Mi unidad"
    
    # Usamos el primer 'parent'. Drive permite múltiples, pero esto cubre el 99% de los casos.
    parent_id = item['parents'][0]
    
    path_parts = []
    current_parent_id = parent_id

    # Bucle que sube por la jerarquía de carpetas
    while current_parent_id in all_files_map:
        parent_item = all_files_map[current_parent_id]
        path_parts.insert(0, parent_item['name']) # Inserta el nombre al principio de la lista

        if 'parents' in parent_item:
            current_parent_id = parent_item['parents'][0]
        else:
            break # Si el padre no tiene padre, hemos llegado a la raíz
            
    # Une todas las partes de la ruta
    full_path = "/".join(path_parts)
    
    # Añadimos "Mi unidad" al principio
    return f"Mi unidad/{full_path}"


def main():
    creds = None
    if os.path.exists("token.json"):
        creds = Credentials.from_authorized_user_file("token.json", SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file("credentials.json", SCOPES)
            creds = flow.run_local_server(port=0)
        with open("token.json", "w") as token:
            token.write(creds.to_json())

    try:
        service_drive = build("drive", "v3", credentials=creds)
        service_sheets = build("sheets", "v4", credentials=creds)

        print("\nConexión exitosa. Iniciando escaneo COMPLETO y PROFUNDO de Drive...")
        
        all_items = []
        page_token = None
        while True:
            results = service_drive.files().list(
                pageSize=1000,
                fields="nextPageToken, files(id, name, mimeType, webViewLink, trashed, permissions, parents)",
                q="trashed=false", # Excluimos archivos en la papelera desde la consulta
                pageToken=page_token
            ).execute()
            
            items = results.get("files", [])
            all_items.extend(items)
            
            page_token = results.get('nextPageToken', None)
            if page_token is None:
                break

        print(f"Escaneo completo. Se encontraron {len(all_items)} elementos.")
        print("Creando mapa de rutas optimizado...")

        # El mapa de archivos es la clave para que esto sea rápido
        all_files_map = {item['id']: item for item in all_items}

        print("Generando filas para Google Sheets con rutas correctas...")
        valores_para_la_hoja = []
        for item in all_files_map.values():
            
            # Calculamos la ruta completa usando la nueva función
            path = get_full_path(item['id'], all_files_map)

            enlace_compartir = "Privado"
            if 'permissions' in item:
                for perm in item['permissions']:
                    if perm.get('type') == 'anyone':
                        enlace_compartir = item.get('webViewLink', 'N/A')
                        break
            
            tipo = "Carpeta" if item["mimeType"] == "application/vnd.google-apps.folder" else "Archivo"
            
            # El orden de las columnas que definiste
            fila = [
                CUENTA_ACTUAL,
                item.get('name', 'N/A'),
                path,
                tipo,
                item.get('webViewLink', 'N/A'),
                enlace_compartir
            ]
            valores_para_la_hoja.append(fila)

        print(f"Escribiendo {len(valores_para_la_hoja)} filas en la hoja de cálculo...")

        service_sheets.spreadsheets().values().clear(
            spreadsheetId=SPREADSHEET_ID,
            range='A2:F'
        ).execute()

        body = {'values': valores_para_la_hoja}
        service_sheets.spreadsheets().values().update(
            spreadsheetId=SPREADSHEET_ID,
            range='A2',
            valueInputOption='USER_ENTERED',
            body=body
        ).execute()

        print("-" * 60)
        print("¡Éxito! Tu directorio ha sido actualizado con las rutas completas y correctas.")
        print(f"Puedes verlo aquí: https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}")
        print("-" * 60)

    except HttpError as error:
        print(f"Ocurrió un error: {error}")

if __name__ == "__main__":
    main() 