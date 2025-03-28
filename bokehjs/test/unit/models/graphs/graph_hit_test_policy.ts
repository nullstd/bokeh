import * as sinon from "sinon"

import {expect, expect_not_null} from "assertions"
import {display} from "../../_util"

import {Selection} from "@bokehjs/models/selections/selection"
import {Plot} from "@bokehjs/models/plots/plot"
import {Range1d} from "@bokehjs/models/ranges/range1d"

import {Scatter} from "@bokehjs/models/glyphs/scatter"
import {MultiLine} from "@bokehjs/models/glyphs/multi_line"
import {EdgesOnly, NodesOnly, NodesAndLinkedEdges, EdgesAndLinkedNodes, NodesAndAdjacentNodes} from "@bokehjs/models/graphs/graph_hit_test_policy"
import {LayoutProvider} from "@bokehjs/models/graphs/layout_provider"
import {GlyphRenderer} from "@bokehjs/models/renderers/glyph_renderer"
import type {GraphRendererView} from "@bokehjs/models/renderers/graph_renderer"
import {GraphRenderer} from "@bokehjs/models/renderers/graph_renderer"
import type {ColumnarDataSource} from "@bokehjs/models/sources/columnar_data_source"
import {ColumnDataSource} from "@bokehjs/models/sources/column_data_source"
import {build_view} from "@bokehjs/core/build_views"
import type {Arrayable} from "@bokehjs/core/types"
import {repeat} from "@bokehjs/core/util/array"

class TrivialLayoutProvider extends LayoutProvider {

  get_node_coordinates(graph_source: ColumnarDataSource): [Arrayable<number>, Arrayable<number>] {
    const n = graph_source.get_length() ?? 1
    return [new Float64Array(n), new Float64Array(n)]
  }

  get_edge_coordinates(graph_source: ColumnarDataSource): [Arrayable<number>[], Arrayable<number>[]] {
    const n = graph_source.get_length() ?? 1
    return [repeat([], n), repeat([], n)]
  }
}

describe("GraphHitTestPolicy", () => {
  let node_source: ColumnDataSource
  let edge_source: ColumnDataSource
  let gr: GraphRenderer
  let gv: GraphRendererView
  let node_stub: sinon.SinonStub
  let edge_stub: sinon.SinonStub

  before_each(async () => {
    const plot = new Plot({
      x_range: new Range1d({start: 0, end: 1}),
      y_range: new Range1d({start: 0, end: 1}),
    })
    const {view: plot_view} = await display(plot)

    node_source = new ColumnDataSource({
      data: {
        index: [10, 20, 30, 40],
      },
    })
    edge_source = new ColumnDataSource({
      data: {
        start: [10, 10, 30],
        end: [20, 30, 20],
        xs: [[1, 2, 3], [4, 5, 6], [7, 8, 9]],
        ys: [[1, 2, 3], [4, 5, 6], [7, 8, 9]],
      },
    })
    const node_renderer = new GlyphRenderer({data_source: node_source, glyph: new Scatter()})
    const edge_renderer = new GlyphRenderer({data_source: edge_source, glyph: new MultiLine()})

    gr = new GraphRenderer({
      node_renderer,
      edge_renderer,
      layout_provider: new TrivialLayoutProvider(),
    })

    gv = await build_view(gr, {parent: plot_view})

    node_stub = sinon.stub(gv.node_view.glyph, "hit_test")
    edge_stub = sinon.stub(gv.edge_view.glyph, "hit_test")
  })

  after_each(() => {
    node_stub.restore()
    edge_stub.restore()
  })

  describe("EdgesOnly", () => {

    describe("hit_test method", () => {

      it("should return null if GlyphView doesn't have hit-testing and returns null", () => {
        edge_stub.returns(null)
        const policy = new EdgesOnly()
        expect(policy.hit_test({type: "point", sx: 0, sy: 0}, gv)).to.be.null
      })

      it("should return the Selection that the GlyphView hit-testing returns", () => {
        edge_stub.returns(new Selection({indices: [1, 2]}))
        const policy = new EdgesOnly()
        const result = policy.hit_test({type: "point", sx: 0, sy: 0}, gv)
        expect_not_null(result)
        expect(result.indices).to.be.equal([1, 2])
      })
    })

    describe("do_selection method", () => {

      it("should return false if called with null hit_test_result", () => {
        const policy = new EdgesOnly()
        expect(policy.do_selection(null, gr, true, "replace")).to.be.false
      })

      it("should return false and clear selections if hit_test_result is empty", () => {
        const initial_selection = new Selection({indices: [1, 2]})
        edge_source.selected = initial_selection

        const hit_test_result = new Selection()
        const policy = new EdgesOnly()
        const did_hit = policy.do_selection(hit_test_result, gr, true, "replace")

        expect(did_hit).to.be.false
        expect(edge_source.selected.is_empty()).to.be.true
      })

      it("should return true if hit_test_result is not empty", () => {
        const hit_test_result = new Selection({indices: [0, 1]})
        const policy = new EdgesOnly()

        expect(policy.do_selection(hit_test_result, gr, true, "replace")).to.be.true
        expect(edge_source.selected.is_empty()).to.be.false
      })
    })

    describe("do_inspection method", () => {

      it("should return false and clear inspections if hit_test_result is empty", () => {
        // create initial inspection to clear
        const initial_inspection = new Selection({indices: [1, 2]})
        edge_source.inspected = initial_inspection

        const hit_test_result = new Selection()
        const policy = new EdgesOnly()
        const did_hit = policy.do_inspection(hit_test_result, {type: "point", sx: 0, sy: 0}, gv, true, "replace")

        expect(did_hit).to.be.false
        expect(edge_source.inspected.is_empty()).to.be.true
      })

      it("should return true if hit_test_result is not empty", () => {
        const hit_test_result = new Selection({indices: [0, 1]})
        const policy = new EdgesOnly()

        const did_hit = policy.do_inspection(hit_test_result, {type: "point", sx: 0, sy: 0}, gv, true, "replace")
        expect(did_hit).to.be.true
        expect(edge_source.inspected.is_empty()).to.be.false
      })
    })
  })

  describe("NodesOnly", () => {

    describe("hit_test method", () => {

      it("should return null if GlyphView doesn't have hit-testing and returns null", () => {
        node_stub.returns(null)
        const policy = new NodesOnly()
        expect(policy.hit_test({type: "point", sx: 0, sy: 0}, gv)).to.be.null
      })

      it("should return the Selection that the GlyphView hit-testing returns", () => {
        node_stub.returns(new Selection({indices: [1, 2, 3]}))
        const policy = new NodesOnly()
        const result = policy.hit_test({type: "point", sx: 0, sy: 0}, gv)
        expect_not_null(result)
        expect(result.indices).to.be.equal([1, 2, 3])
      })
    })

    describe("do_selection method", () => {

      it("should return false if called with null hit_test_result", () => {
        const policy = new NodesOnly()
        expect(policy.do_selection(null, gr, true, "replace")).to.be.false
      })

      it("should return false and clear selections if hit_test_result is empty", () => {
        const initial_selection = new Selection({indices: [1, 2]})
        node_source.selected = initial_selection

        const hit_test_result = new Selection()
        const policy = new NodesOnly()
        const did_hit = policy.do_selection(hit_test_result, gr, true, "replace")

        expect(did_hit).to.be.false
        expect(node_source.selected.is_empty()).to.be.true
      })

      it("should return true if hit_test_result is not empty", () => {
        const hit_test_result = new Selection({indices: [0, 1]})
        const policy = new NodesOnly()

        expect(policy.do_selection(hit_test_result, gr, true, "replace")).to.be.true
        expect(node_source.selected.is_empty()).to.be.false
      })
    })

    describe("do_inspection method", () => {

      it("should return false and clear inspections if hit_test_result is empty", () => {
        // create initial inspection to clear
        const initial_inspection = new Selection({indices: [1, 2]})
        node_source.inspected = initial_inspection

        const hit_test_result = new Selection()
        const policy = new NodesOnly()
        const did_hit = policy.do_inspection(hit_test_result, {type: "point", sx: 0, sy: 0}, gv, true, "replace")

        expect(did_hit).to.be.false
        expect(node_source.inspected.is_empty()).to.be.true
      })

      it("should return true if hit_test_result is not empty", () => {
        const hit_test_result = new Selection({indices: [0, 1]})
        const policy = new NodesOnly()

        const did_hit = policy.do_inspection(hit_test_result, {type: "point", sx: 0, sy: 0}, gv, true, "replace")
        expect(did_hit).to.be.true
        expect(node_source.inspected.is_empty()).to.be.false
      })
    })
  })

  describe("NodesAndLinkedEdges", () => {

    describe("do_selection method", () => {

      it("should clear edge selections if hit_test_result is empty", () => {
        // create initial inspection to clear
        const initial_selection = new Selection()
        initial_selection.multiline_indices = new Map([[0, [0, 1]], [1, [0]]])
        edge_source.selected = initial_selection

        const hit_test_result = new Selection()
        const policy = new NodesAndLinkedEdges()
        policy.do_selection(hit_test_result, gr, true, "replace")

        expect(edge_source.selected.is_empty()).to.be.true
      })

      it("should select linked edges if hit_test_result is not empty", () => {
        const hit_test_result = new Selection({indices: [0]})
        const policy = new NodesAndLinkedEdges()

        policy.do_selection(hit_test_result, gr, true, "replace")

        expect(edge_source.selected.multiline_indices).to.be.equal(new Map([[0, [0]], [1, [0]]]))
      })
    })

    describe("do_inspection method", () => {

      it("should clear edge inspections if hit_test_result is empty", () => {
        // create initial inspection to clear
        const initial_inspection = new Selection()
        initial_inspection.multiline_indices = new Map([[0, [0, 1]], [1, [0]]])
        edge_source.inspected = initial_inspection

        const hit_test_result = new Selection()
        const policy = new NodesAndLinkedEdges()
        const did_hit = policy.do_inspection(hit_test_result, {type: "point", sx: 0, sy: 0}, gv, true, "replace")

        expect(did_hit).to.be.false
        expect(edge_source.inspected.is_empty()).to.be.true
      })

      it("should select linked edges if hit_test_result is not empty", () => {
        const hit_test_result = new Selection({indices: [0]})
        const policy = new NodesAndLinkedEdges()
        const did_hit = policy.do_inspection(hit_test_result, {type: "point", sx: 0, sy: 0}, gv, true, "replace")

        expect(did_hit).to.be.true
        expect(edge_source.inspected.multiline_indices).to.be.equal(new Map([[0, [0]], [1, [0]]]))
      })
    })
  })

  describe("EdgesAndLinkedNodes", () => {

    describe("do_selection method", () => {

      it("should clear node selections if hit_test result is empty", () => {
        const initial_selection = new Selection()
        initial_selection.indices = [0, 1]
        node_source.selected = initial_selection

        const hit_test_result = new Selection()
        const policy = new EdgesAndLinkedNodes()
        policy.do_selection(hit_test_result, gr, true, "replace")

        expect(node_source.selected.is_empty()).to.be.true
      })

      it("should select linked nodes if hit_test_result is not empty", () => {
        const hit_test_result = new Selection()
        hit_test_result.indices = [1]

        const policy = new EdgesAndLinkedNodes()
        policy.do_selection(hit_test_result, gr, true, "replace")

        expect(node_source.selected.indices).to.be.equal([0, 2])
      })
    })

    describe("do_inspection method", () => {

      it("should clear node inspections if hit_test_result is empty", () => {
        const initial_inspection = new Selection({indices: [0, 1]})
        node_source.inspected = initial_inspection

        const hit_test_result = new Selection()
        const policy = new EdgesAndLinkedNodes()
        const did_hit = policy.do_inspection(hit_test_result, {type: "point", sx: 0, sy: 0}, gv, true, "replace")

        expect(did_hit).to.be.false
        expect(node_source.inspected.is_empty()).to.be.true
      })

      it("should inspect linked nodes if hit_test_result is not empty", () => {
        const hit_test_result = new Selection()
        hit_test_result.indices = [1]

        const policy = new EdgesAndLinkedNodes()
        const did_hit = policy.do_inspection(hit_test_result, {type: "point", sx: 0, sy: 0}, gv, true, "replace")

        expect(did_hit).to.be.true
        expect(node_source.inspected.indices).to.be.equal([0, 2])
      })
    })
  })

  describe("NodesAndAdjacentNodes", () => {

    describe("do_selection method", () => {

      it("should clear node selections if hit_test result is empty", () => {
        const initial_selection = new Selection()
        initial_selection.indices = [0, 1]
        node_source.selected = initial_selection

        const hit_test_result = new Selection()
        const policy = new NodesAndAdjacentNodes()
        policy.do_selection(hit_test_result, gr, true, "replace")

        expect(node_source.selected.is_empty()).to.be.true
      })

      it("should select adjacent nodes if hit_test_result is not empty", () => {
        const hit_test_result = new Selection()
        hit_test_result.indices = [1]

        const policy = new NodesAndAdjacentNodes()
        policy.do_selection(hit_test_result, gr, true, "replace")

        expect(node_source.selected.indices).to.be.equal([0, 2, 1])
      })
    })

    describe("do_inspection method", () => {

      it("should clear node inspections if hit_test_result is empty", () => {
        // create initial inspection to clear
        const initial_inspection = new Selection({indices: [0, 1]})
        node_source.inspected = initial_inspection

        const hit_test_result = new Selection()
        const policy = new NodesAndAdjacentNodes()
        const did_hit = policy.do_inspection(hit_test_result, {type: "point", sx: 0, sy: 0}, gv, true, "replace")

        expect(did_hit).to.be.false
        expect(node_source.inspected.is_empty()).to.be.true
      })

      it("should inspect adjacent nodes if hit_test_result is not empty", () => {
        const hit_test_result = new Selection({indices: [1]})

        const policy = new NodesAndAdjacentNodes()
        const did_hit = policy.do_inspection(hit_test_result, {type: "point", sx: 0, sy: 0}, gv, true, "replace")

        expect(did_hit).to.be.true
        expect(node_source.inspected.indices).to.be.equal([0, 2, 1])
      })
    })
  })
})
