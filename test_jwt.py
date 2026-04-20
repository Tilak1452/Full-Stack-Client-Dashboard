from jose import jwt

token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vbHZ0bmdzc3JzZ3prcWd0YW9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNzA3MjYsImV4cCI6MjA5MTc0NjcyNn0.xXK2RH8mDcd9IU1nBreDcUkvGQBPc9eT_8oVu5x3Jys"
secret = "3cb24b68-dd52-4958-8bdb-5f7024089aa4"

try:
    payload = jwt.decode(token, secret, algorithms=["HS256"], options={"verify_aud": False})
    print("SUCCESS: Original secret worked")
    print(payload)
except Exception as e:
    print(f"FAILED with original secret: {type(e).__name__} - {e}")
