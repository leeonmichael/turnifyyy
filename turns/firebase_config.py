
import os
import firebase_admin
from firebase_admin import credentials,firestore

BASE_DIR=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
key_path=os.path.join(BASE_DIR,"firebase_key.json")

try:
    cred=credentials.Certificate(key_path)
    firebase_admin.initialize_app(cred)
    db=firestore.client()
except:
    db=None
