import * as sinon from "sinon"

import {expect} from "assertions"
import {display} from "../../../_util"

import {build_view} from "@bokehjs/core/build_views"

import type {ScatterView} from "@bokehjs/models/glyphs/scatter"
import {Scatter} from "@bokehjs/models/glyphs/scatter"
import type {PatchesView} from "@bokehjs/models/glyphs/patches"
import {Patches} from "@bokehjs/models/glyphs/patches"
import {Plot} from "@bokehjs/models/plots/plot"
import {Range1d} from "@bokehjs/models/ranges/range1d"
import {Selection} from "@bokehjs/models/selections/selection"
import {GlyphRenderer} from "@bokehjs/models/renderers/glyph_renderer"
import {ColumnDataSource} from "@bokehjs/models/sources/column_data_source"
import type {PolyEditToolView} from "@bokehjs/models/tools/edit/poly_edit_tool"
import {PolyEditTool} from "@bokehjs/models/tools/edit/poly_edit_tool"

import {make_pan_event, make_tap_event, make_move_event, make_key_event} from "./_util"

export interface PolyEditTestCase {
  data: {[key: string]: (number[] | null)[]}
  data_source: ColumnDataSource
  draw_tool_view: PolyEditToolView
  glyph_view: PatchesView
  glyph_renderer: GlyphRenderer<Patches>
  vertex_glyph_view: ScatterView
  vertex_source: ColumnDataSource
  vertex_renderer: GlyphRenderer
}

async function make_testcase(): Promise<PolyEditTestCase> {
  // Note default plot dimensions is 600 x 600 (height x width)
  const plot = new Plot({
    x_range: new Range1d({start: -1, end: 1}),
    y_range: new Range1d({start: -1, end: 1}),
  })

  const {view: plot_view} = await display(plot)

  const data = {
    xs: [[0, 0.5, 1], [0, 0.5, 1]],
    ys: [[0, -0.5, -1], [0, -0.5, -1]],
    z: [null, null],
  }
  const data_source = new ColumnDataSource({data})
  const vertex_source = new ColumnDataSource({data: {x: [], y: []}})

  const glyph = new Patches({
    xs: {field: "xs"},
    ys: {field: "ys"},
  })
  const vertex_glyph = new Scatter({
    x: {field: "x"},
    y: {field: "y"},
  })

  const glyph_renderer = new GlyphRenderer({glyph, data_source})
  const glyph_renderer_view = await build_view(glyph_renderer, {parent: plot_view})
  sinon.stub(glyph_renderer_view, "set_data")

  const vertex_renderer = new GlyphRenderer({glyph: vertex_glyph, data_source: vertex_source})
  const vertex_renderer_view = await build_view(vertex_renderer, {parent: plot_view})

  const draw_tool = new PolyEditTool({
    active: true,
    default_overrides: {z: "Test"},
    renderers: [glyph_renderer],
    vertex_renderer,
  })
  plot.add_tools(draw_tool)
  await plot_view.ready

  const draw_tool_view = plot_view.owner.get_one(draw_tool)
  plot_view.renderer_views.set(glyph_renderer, glyph_renderer_view)
  plot_view.renderer_views.set(vertex_renderer, vertex_renderer_view)

  return {
    data,
    data_source,
    draw_tool_view,
    glyph_view: glyph_renderer_view.glyph as PatchesView,
    glyph_renderer,
    vertex_glyph_view: vertex_renderer_view.glyph as ScatterView,
    vertex_source,
    vertex_renderer,
  }
}

describe("PolyEditTool", (): void => {

  describe("Model", () => {

    it("should create proper tooltip", () => {
      const tool0 = new PolyEditTool()
      expect(tool0.tooltip).to.be.equal("Poly Edit Tool")

      const tool1 = new PolyEditTool({description: "My Poly Edit"})
      expect(tool1.tooltip).to.be.equal("My Poly Edit")
    })
  })

  describe("View", () => {

    it("should select patches on tap", async () => {
      const testcase = await make_testcase()
      const hit_test_stub = sinon.stub(testcase.glyph_view, "hit_test")
      const vertex_hit_test_stub = sinon.stub(testcase.vertex_glyph_view, "hit_test")

      hit_test_stub.returns(new Selection({indices: [1]}))
      vertex_hit_test_stub.returns(null)

      const tap_event = make_tap_event(300, 300)
      testcase.draw_tool_view._tap(tap_event)

      expect(testcase.data_source.selected.indices).to.be.equal([1])
    })

    it("should select multiple patches on shift-tap", async () => {
      const testcase = await make_testcase()
      const hit_test_stub = sinon.stub(testcase.glyph_view, "hit_test")
      const vertex_hit_test_stub = sinon.stub(testcase.vertex_glyph_view, "hit_test")

      vertex_hit_test_stub.returns(null)
      hit_test_stub.returns(new Selection({indices: [1]}))
      let tap_event = make_tap_event(300, 300)
      testcase.draw_tool_view._tap(tap_event)
      hit_test_stub.returns(new Selection({indices: [0]}))
      tap_event = make_tap_event(560, 560, true)
      testcase.draw_tool_view._tap(tap_event)

      expect(testcase.data_source.selected.indices).to.be.equal([1, 0])
    })

    it("should delete selected patch on delete key", async () => {
      const testcase = await make_testcase()
      const hit_test_stub = sinon.stub(testcase.glyph_view, "hit_test")
      const vertex_hit_test_stub = sinon.stub(testcase.vertex_glyph_view, "hit_test")

      hit_test_stub.returns(new Selection({indices: [1]}))
      vertex_hit_test_stub.returns(null)
      const tap_event = make_tap_event(300, 300)
      testcase.draw_tool_view._tap(tap_event)

      const moveenter_event = make_move_event(300, 300)
      const keyup_event = make_key_event("Backspace")
      testcase.draw_tool_view._move_enter(moveenter_event)
      testcase.draw_tool_view._keyup(keyup_event)

      expect(testcase.data_source.selected.indices).to.be.equal([])
      expect(testcase.data_source.data).to.be.equal({
        xs: [[0, 0.5, 1]],
        ys: [[0, -0.5, -1]],
        z: [null],
      })
    })

    it("should clear selection on escape key", async () => {
      const testcase = await make_testcase()
      const hit_test_stub = sinon.stub(testcase.glyph_view, "hit_test")
      const vertex_hit_test_stub = sinon.stub(testcase.vertex_glyph_view, "hit_test")

      vertex_hit_test_stub.returns(null)
      hit_test_stub.returns(new Selection({indices: [1]}))
      const tap_event = make_tap_event(300, 300)
      testcase.draw_tool_view._tap(tap_event)

      const moveenter_event = make_move_event(300, 300)
      const keyup_event = make_key_event("Escape")
      testcase.draw_tool_view._move_enter(moveenter_event)
      testcase.draw_tool_view._keyup(keyup_event)

      expect(testcase.data_source.selected.indices).to.be.equal([])
      expect(testcase.data_source.data).to.be.equal(testcase.data)
    })

    it("should show vertices on press", async () => {
      const testcase = await make_testcase()
      const hit_test_stub = sinon.stub(testcase.glyph_view, "hit_test")
      sinon.stub(testcase.vertex_glyph_view, "hit_test").returns(null)

      hit_test_stub.returns(new Selection({indices: [1]}))
      const tap_event = make_tap_event(300, 300)
      testcase.draw_tool_view._press(tap_event)

      expect(testcase.vertex_source.data).to.be.equal({
        x: testcase.data.xs[1] as any, // XXX: null
        y: testcase.data.ys[1] as any, // XXX: null
      })
      expect(testcase.draw_tool_view._selected_renderer).to.be.equal(testcase.glyph_renderer)
    })

    it("should select vertex on tap", async () => {
      const testcase = await make_testcase()
      const hit_test_stub = sinon.stub(testcase.glyph_view, "hit_test")
      const vertex_hit_test_stub = sinon.stub(testcase.vertex_glyph_view, "hit_test")

      vertex_hit_test_stub.returns(null)
      hit_test_stub.returns(new Selection({indices: [1]}))
      const tap_event = make_tap_event(300, 300)
      testcase.draw_tool_view._press(tap_event)
      vertex_hit_test_stub.returns(new Selection({indices: [1]}))
      testcase.draw_tool_view._tap(tap_event)
      expect(testcase.vertex_source.selected.indices).to.be.equal([1])
    })

    it("should delete selected vertex on tap", async () => {
      const testcase = await make_testcase()
      const hit_test_stub = sinon.stub(testcase.glyph_view, "hit_test")
      const vertex_hit_test_stub = sinon.stub(testcase.vertex_glyph_view, "hit_test")

      vertex_hit_test_stub.returns(null)
      hit_test_stub.returns(new Selection({indices: [1]}))
      const tap_event = make_tap_event(300, 300)
      testcase.draw_tool_view._press(tap_event)

      vertex_hit_test_stub.returns(new Selection({indices: [1]}))
      testcase.draw_tool_view._tap(tap_event)

      const moveenter_event = make_move_event(300, 300)
      const keyup_event = make_key_event("Backspace")
      testcase.draw_tool_view._move_enter(moveenter_event)
      testcase.draw_tool_view._keyup(keyup_event)

      expect(testcase.vertex_source.selected.indices).to.be.equal([])
      expect(testcase.vertex_source.data).to.be.equal({
        x: [0, 1],
        y: [0, -1],
      })
      expect(testcase.data_source.data).to.be.equal({
        xs: [[0, 0.5, 1], [0, 1]],
        ys: [[0, -0.5, -1], [0, -1]],
        z: [null, null],
      })
    })

    it("should drag vertex on pan", async () => {
      const testcase = await make_testcase()
      const hit_test_stub = sinon.stub(testcase.glyph_view, "hit_test")
      const vertex_hit_test_stub = sinon.stub(testcase.vertex_glyph_view, "hit_test")

      hit_test_stub.returns(new Selection({indices: [1]}))
      vertex_hit_test_stub.returns(null)
      const tap_event = make_tap_event(300, 300)
      testcase.draw_tool_view._press(tap_event)
      vertex_hit_test_stub.returns(new Selection({indices: [1]}))
      const panstart_event = make_pan_event(300, 300)
      testcase.draw_tool_view._pan_start(panstart_event)
      const pan_event = make_pan_event(290, 290)
      testcase.draw_tool_view._pan(pan_event)
      testcase.draw_tool_view._pan_end(pan_event)

      expect(testcase.vertex_source.selected.indices).to.be.equal([])
      expect(testcase.vertex_source.data).to.be.equal({
        x: [0, 0.4646017699115044, 1],
        y: [0, -0.4661016949152542, -1],
      })
      expect(testcase.data_source.data).to.be.equal({
        xs: [[0, 0.5, 1], [0, 0.4646017699115044, 1]],
        ys: [[0, -0.5, -1], [0, -0.4661016949152542, -1]],
        z: [null, null],
      })
    })

    it("should add vertex on press", async () => {
      const testcase = await make_testcase()
      const hit_test_stub = sinon.stub(testcase.glyph_view, "hit_test")
      const vertex_hit_test_stub = sinon.stub(testcase.vertex_glyph_view, "hit_test")

      hit_test_stub.returns(new Selection({indices: [1]}))
      vertex_hit_test_stub.returns(null)
      const tap_event = make_tap_event(300, 300)
      testcase.draw_tool_view._press(tap_event) // Poly selected
      vertex_hit_test_stub.returns(new Selection({indices: [1]}))
      testcase.draw_tool_view._press(tap_event) // Vertex selected
      vertex_hit_test_stub.returns(new Selection({indices: [2]}))
      testcase.draw_tool_view._press(make_tap_event(290, 290)) // Add new vertex

      const xs = [0, 0.5, 0.04424778761061947, 1]
      const ys = [0, -0.5, -0, -1]
      expect(testcase.vertex_source.selected.indices).to.be.equal([])
      expect(testcase.vertex_source.data).to.be.equal({
        x: xs,
        y: ys,
      })
      expect(testcase.data_source.data).to.be.equal({
        xs: [[0, 0.5, 1], xs],
        ys: [[0, -0.5, -1], ys],
        z: [null, null],
      })
    })

    it("should add vertex on tap after press ", async () => {
      const testcase = await make_testcase()
      const hit_test_stub = sinon.stub(testcase.glyph_view, "hit_test")
      const vertex_hit_test_stub = sinon.stub(testcase.vertex_glyph_view, "hit_test")

      hit_test_stub.returns(new Selection({indices: [1]}))
      vertex_hit_test_stub.returns(null)
      const tap_event = make_tap_event(300, 300)
      testcase.draw_tool_view._press(tap_event) // Poly selected
      vertex_hit_test_stub.returns(new Selection({indices: [1]}))
      testcase.draw_tool_view._press(tap_event) // Vertex selected
      vertex_hit_test_stub.returns(new Selection({indices: [2]}))
      const tap_event2 = make_tap_event(290, 290)
      const moveenter_event = make_move_event(290, 290)
      const key_event = make_key_event("Escape")
      testcase.draw_tool_view._tap(tap_event2) // Add new vertex
      testcase.draw_tool_view._move_enter(moveenter_event)
      testcase.draw_tool_view._keyup(key_event) // Stop editing

      const xs = [0, 0.5, 0.04424778761061947, 1]
      const ys = [0, -0.5, -0, -1]
      expect(testcase.vertex_source.selected.indices).to.be.equal([])
      expect(testcase.vertex_source.data).to.be.equal({
        x: xs,
        y: ys,
      })
      expect(testcase.data_source.data).to.be.equal({
        xs: [[0, 0.5, 1], xs],
        ys: [[0, -0.5, -1], ys],
        z: [null, null],
      })
    })
  })
})
