import tempfile
import unittest
from pathlib import Path

import build_outflow_v3
from build_prolongation import DEFAULT_DATA, DEFAULT_TEMPLATE, build


class BuildProlongationTest(unittest.TestCase):
    def test_generated_page_contains_its_assets_and_external_analysis_link(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            tree = Path(directory) / "outflow-tree-v3.html"
            build_outflow_v3.build(
                build_outflow_v3.DEFAULT_TEMPLATE,
                tree,
                build_outflow_v3.DEFAULT_GRAPH,
                build_outflow_v3.DEFAULT_CUBE,
                build_outflow_v3.DEFAULT_CHARTS_JS,
                build_outflow_v3.DEFAULT_CHARTS_CSS,
            )
            output = Path(directory) / "prolongation.html"
            build(DEFAULT_TEMPLATE, output, tree, DEFAULT_DATA)
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
