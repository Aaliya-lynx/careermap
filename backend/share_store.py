"""Short share links need somewhere to keep a shared roadmap. Two stores, the same two methods:

MemoryStore   : a dictionary in the server's memory (tests, local use). Lost when the server restarts.
CloudflareKV  : Cloudflare Workers KV over its REST API. Survives restarts and sleeping, which a free host's disk does not.

Only a roadmap that someone chose to share is stored, under a random id, and it expires after 90 days.
No name, email, GitHub link or certificate is ever part of it.
"""
import os
import secrets
import time

import httpx

TTL_SECONDS = 90 * 24 * 3600
ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"     # no look-alike characters
ID_LENGTH = 8


class StoreError(Exception):
    """The place where shared roadmaps are kept could not be reached."""


def new_id():
    return "".join(secrets.choice(ALPHABET) for _ in range(ID_LENGTH))


class MemoryStore:
    persistent = False        # lost when the server restarts, so it is not used for real short links unless allowed

    def __init__(self, ttl=TTL_SECONDS, limit=2000, clock=time.time):
        self.ttl, self.limit, self.clock = ttl, limit, clock
        self.items = {}           # key -> (value, expires_at); insertion order = age

    def put(self, key, value):
        self.items[key] = (value, self.clock() + self.ttl)
        while len(self.items) > self.limit:
            del self.items[next(iter(self.items))]

    def get(self, key):
        found = self.items.get(key)
        if not found:
            return None
        if found[1] <= self.clock():
            del self.items[key]
            return None
        return found[0]


class CloudflareKV:
    persistent = True

    def __init__(self, account_id, namespace_id, token, client=None, ttl=TTL_SECONDS):
        self.base = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/storage/kv/namespaces/{namespace_id}/values"
        self.headers = {"Authorization": f"Bearer {token}"}
        self.client = client or httpx.Client(timeout=10)
        self.ttl = ttl

    def put(self, key, value):
        try:
            r = self.client.put(f"{self.base}/{key}", params={"expiration_ttl": self.ttl}, content=value.encode("utf-8"), headers=self.headers)
        except httpx.HTTPError as error:
            raise StoreError("could not reach the storage") from error
        if r.status_code != 200:
            raise StoreError(f"storage answered {r.status_code}")

    def get(self, key):
        try:
            r = self.client.get(f"{self.base}/{key}", headers=self.headers)
        except httpx.HTTPError as error:
            raise StoreError("could not reach the storage") from error
        if r.status_code == 404:
            return None
        if r.status_code != 200:
            raise StoreError(f"storage answered {r.status_code}")
        return r.text


def from_env(env=os.environ):
    account, namespace, token = env.get("CF_ACCOUNT_ID"), env.get("CF_KV_NAMESPACE_ID"), env.get("CF_API_TOKEN")
    if account and namespace and token:
        return CloudflareKV(account, namespace, token)
    return MemoryStore()
