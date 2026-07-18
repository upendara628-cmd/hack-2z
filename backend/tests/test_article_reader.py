import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import app


def test_article_reader_requires_text_or_url():
    client = app.test_client()
    response = client.post('/api/article-read', json={})
    assert response.status_code == 400
