import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def pins(path):
    result = {}
    for line in path.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        name, _, version = line.partition('==')
        result[name.strip().lower()] = version.strip()
    return result


class RequirementsSyncTests(unittest.TestCase):
    def test_root_requirements_pin_the_same_versions_as_backend(self):
        # Vercel installs only the root requirements.txt, so it must pin exactly what backend/requirements.txt pins.
        self.assertEqual(pins(ROOT / 'requirements.txt'), pins(ROOT / 'backend' / 'requirements.txt'))
