import base64
import re
import tempfile
import unittest
from pathlib import Path

from build_prolongation import DEFAULT_DATA, DEFAULT_TEMPLATE, DEFAULT_TREE, build


class BuildProlongationTest(unittest.TestCase):
    def test_generated_page_contains_its_assets_and_linked_analysis(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "prolongation.html"
            build(DEFAULT_TEMPLATE, output, DEFAULT_TREE, DEFAULT_DATA)
            page = output.read_text(encoding="utf-8")

        self.assertNotIn('src="./charts-dist/dd-charts.js"', page)
        self.assertNotIn('href="./charts-dist/dd-charts.css"', page)
        self.assertIn("URL.createObjectURL", page)
        match = re.search(r'id="journey-analysis-html">(.*?)</script>', page, re.DOTALL)
        self.assertIsNotNone(match)
        analysis = base64.b64decode(match.group(1)).decode("utf-8")
        self.assertIn("LossHunter", analysis)


if __name__ == "__main__":
    unittest.main()
