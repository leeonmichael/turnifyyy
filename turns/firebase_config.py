
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
    firebase_admin.initialize_app(cred)
    db=firestore.client()
except:
    db=None
