#-----------------------------------------------------------------------------
# Copyright (c) Anaconda, Inc., and Bokeh Contributors.
# All rights reserved.
#
# The full license is in the file LICENSE.txt, distributed with this software.
#-----------------------------------------------------------------------------

#-----------------------------------------------------------------------------
# Boilerplate
#-----------------------------------------------------------------------------
from __future__ import annotations # isort:skip

import pytest ; pytest

#-----------------------------------------------------------------------------
# Imports
#-----------------------------------------------------------------------------

# External imports
import pandas as pd

# Bokeh imports
from bokeh.core.properties import field
from bokeh.models import ColumnDataSource, MultiLine, Scatter

# Module under test
import bokeh.plotting._graph as bpg # isort:skip

#-----------------------------------------------------------------------------
# Setup
#-----------------------------------------------------------------------------

#-----------------------------------------------------------------------------
# General API
#-----------------------------------------------------------------------------

#-----------------------------------------------------------------------------
# Dev API
#-----------------------------------------------------------------------------


class Test_get_graph_kwargs:
    def test_convert_dataframes_to_sources(self) -> None:
        node_source = pd.DataFrame(data=dict(foo=[]))
        edge_source = pd.DataFrame(data=dict(start=[], end=[], bar=[]))

        kw = bpg.get_graph_kwargs(node_source, edge_source)

        # 'index' column is added from pandas df
        assert set(kw['node_renderer'].data_source.data.keys()) == {"index", "foo"}
        assert set(kw['edge_renderer'].data_source.data.keys()) == {"index", "start", "end", "bar"}

    def test_handle_sources(self) -> None:
        node_source = ColumnDataSource(data=dict(foo=[]))
        edge_source = ColumnDataSource(data=dict(start=[], end=[], bar=[]))

        kw = bpg.get_graph_kwargs(node_source, edge_source)

        assert set(kw['node_renderer'].data_source.data.keys()) == {"foo"}
        assert set(kw['edge_renderer'].data_source.data.keys()) == {"start", "end", "bar"}

    def test_handle_node_property_mixins(self) -> None:
        kwargs = dict(node_fill_color="purple", node_selection_fill_color="blue",
                    node_nonselection_fill_color="yellow", node_hover_fill_color="red",
                    node_muted_fill_color="orange", node_radius=0.6)

        kw = bpg.get_graph_kwargs({}, {}, **kwargs)

        r = kw['node_renderer']
        assert r.glyph.fill_color == "purple"
        assert r.selection_glyph.fill_color == "blue"
        assert r.nonselection_glyph.fill_color == "yellow"
        assert r.hover_glyph.fill_color == "red"
        assert r.muted_glyph.fill_color == "orange"

        assert r.glyph.radius == 0.6
        assert r.selection_glyph.radius == 0.6
        assert r.nonselection_glyph.radius == 0.6
        assert r.hover_glyph.radius == 0.6
        assert r.muted_glyph.radius == 0.6

    def test_handle_node_marker(self) -> None:
        kw = bpg.get_graph_kwargs({}, {}, node_marker='x')
        node_glyph = kw['node_renderer'].glyph
        assert isinstance(node_glyph, Scatter) and node_glyph.marker == "x"

    def test_handle_node_marker_dataspec_correctly(self) -> None:
        node_source = {'marker': ['square', 'circle', 'x']}

        kw = bpg.get_graph_kwargs(node_source, {}, node_marker='marker')

        node_glyph = kw['node_renderer'].glyph
        assert isinstance(node_glyph, Scatter)
        assert node_glyph.marker == field('marker')

    def test_handle_edge_property_mixins(self) -> None:
        kwargs = dict(edge_line_color="purple", edge_selection_line_color="blue",
                    edge_nonselection_line_color="yellow", edge_hover_line_color="red",
                    edge_muted_line_color="orange", edge_line_width=23)

        kw = bpg.get_graph_kwargs({}, {}, **kwargs)

        r = kw['edge_renderer']
        assert r.glyph.line_color == "purple"
        assert r.selection_glyph.line_color == "blue"
        assert r.nonselection_glyph.line_color == "yellow"
        assert r.hover_glyph.line_color == "red"
        assert r.muted_glyph.line_color == "orange"

        assert r.glyph.line_width == 23
        assert r.selection_glyph.line_width == 23
        assert r.nonselection_glyph.line_width == 23
        assert r.hover_glyph.line_width == 23
        assert r.muted_glyph.line_width == 23

    def test_default_muted_glyph(self) -> None:
        kwargs = dict(
            edge_line_color="purple", edge_line_alpha=0.7,
            node_fill_color="red", node_fill_alpha=0.8, node_line_color="blue",
        )
        kw = bpg.get_graph_kwargs({}, {}, **kwargs)

        r = kw['edge_renderer']
        assert isinstance(r.muted_glyph, MultiLine)
        assert r.muted_glyph.line_color == "purple"
        assert r.muted_glyph.line_alpha == 0.2
        r = kw['node_renderer']
        assert isinstance(r.muted_glyph, Scatter)
        assert r.muted_glyph.fill_color == "red"
        assert r.muted_glyph.line_alpha == 0.2
        assert r.muted_glyph.line_color == "blue"

    def test_bad_input(self) -> None:
        msg = "Failed to auto-convert <class 'int'> to ColumnDataSource.\n Original error: expected a dict or eager dataframe support by Narwhals, got 42"
        with pytest.raises(ValueError, match=msg):
            bpg.get_graph_kwargs(42, {})

        with pytest.raises(ValueError, match=msg):
            bpg.get_graph_kwargs({}, 42)

#-----------------------------------------------------------------------------
# Private API
#-----------------------------------------------------------------------------
