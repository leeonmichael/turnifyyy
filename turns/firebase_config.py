
import os
import json
import firebase_admin
from firebase_admin import credentials,firestore

BASE_DIR=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
key_path=os.path.join(BASE_DIR,"firebase_key.json")
key_json_env=os.environ.get("FIREBASE_CREDENTIALS_JSON")

try:
    if key_json_env:
        cred=credentials.Certificate(json.loads(key_json_env))
    else:
        cred=credentials.Certificate(key_path)
    storage_bucket = os.environ.get("FIREBASE_STORAGE_BUCKET") or f"{cred.project_id}.appspot.com"
    firebase_admin.initialize_app(cred, {"storageBucket": storage_bucket})
    db=firestore.client()
except:
    db=None
