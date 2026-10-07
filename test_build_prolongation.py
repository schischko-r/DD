import tempfile
import unittest
from pathlib import Path

from build_prolongation import DEFAULT_DATA, DEFAULT_TEMPLATE, DEFAULT_TREE, build


class BuildProlongationTest(unittest.TestCase):
    def test_generated_page_contains_its_assets_and_external_analysis_link(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "prolongation.html"
            build(DEFAULT_TEMPLATE, output, DEFAULT_TREE, DEFAULT_DATA)
            page = output.read_text(encoding="utf-8")

        self.assertNotIn('src="./charts-dist/dd-charts.js"', page)
        self.assertNotIn('href="./charts-dist/dd-charts.css"', page)
        self.assertIn(
            'href="https://losshunter.ru/platform/product-closing?q=%D0%BE%D1%81%D0%B0%D0%B3%D0%BE"',
            page,
        )
        self.assertNotIn('id="journey-analysis-html"', page)


if __name__ == "__main__":
    unittest.main()
