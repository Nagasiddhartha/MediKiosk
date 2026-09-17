from app.services.red_thread import _deterministic_embedding


def test_deterministic_embedding_dimension():
    vec = _deterministic_embedding("chest pain radiating to arm")
    assert len(vec) == 768
    # Test normalized length is ~ 1.0
    norm = sum(x * x for x in vec) ** 0.5
    assert abs(norm - 1.0) < 1e-4


def test_embedding_stability():
    text = "Throbbing headache behind eyes"
    vec1 = _deterministic_embedding(text)
    vec2 = _deterministic_embedding(text)
    assert vec1 == vec2
