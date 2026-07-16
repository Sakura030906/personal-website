import os


# Tests use isolated SQLite sessions and must never reach runtime vector services.
os.environ["VECTOR_STORE"] = "local"
os.environ["EMBEDDING_PROVIDER"] = "local"
os.environ["LLM_PROVIDER"] = "local"
os.environ.pop("OPENAI_API_KEY", None)
