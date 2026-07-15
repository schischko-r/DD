import json
import tempfile
import unittest
from pathlib import Path

from build_gravity_standalone import build


class BuildGravityStandaloneTest(unittest.TestCase):
    def test_embeds_data_for_no_store_fetch(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            template = root / "index.html"
            data = root / "report-data.json"
            output = root / "standalone.html"
            template.write_text(
                '<script>fetch("./report-data.json",{cache:"no-store"}).then(load)</script>',
                encoding="utf-8",
            )
            data.write_text(
                json.dumps({"products": [{"name": "Тест\n</script>"}]}),
                encoding="utf-8",
            )

            build(template, data, output)

            result = output.read_text(encoding="utf-8")
            self.assertNotIn("fetch(\"./report-data.json\"", result)
            self.assertIn(
                'Promise.resolve({json: () => Promise.resolve({"products":[{"name":"Тест\\n\\u003c/script\\u003e"}]})})',
                result,
            )
            self.assertNotIn('"name":"Тест\n', result)


if __name__ == "__main__":
    unittest.main()
