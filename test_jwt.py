import json
from jose import jwt

# This is the exact code from security.py
secret = '{"x":"0l3AhQGZ4gg_vZ77GZOwaLrVjy_PHcSMA3EYn6xzT6Q","y":"vkCOCd8CQdOlCuVElyYDv4MiliahjjUkx0ICzd1vLrI","alg":"ES256","crv":"P-256","ext":true,"kid":"3cb24b68-dd52-4958-8bdb-5f7024089aa4","kty":"EC","key_ops":["verify"]}'
key = json.loads(secret)
algorithms = [key.get("alg", "ES256")]

print("Parsed key:", key)
print("Algorithms:", algorithms)

# Let's generate a dummy token just to test decoding works
# Note: we need the private key to sign, so we can't easily generate a valid ES256 token here without it.
# BUT we can check if PyJWT/python-jose complains about the key format.
try:
    jwt.decode("dummy.token.here", key, algorithms=algorithms)
except Exception as e:
    print(f"Exception trying to decode: {type(e).__name__}: {e}")
