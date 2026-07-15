const C3 = self.C3;
self.C3_GetObjectRefTable = function () {
	return [
		C3.Plugins.Sprite,
		C3.Plugins.DrawingCanvas
	];
};
self.C3_JsPropNameTable = [
	{tahta: 0},
	{arkafon: 0},
	{DrawingCanvas: 0},
	{alt: 0},
	{ust: 0},
	{nasiloynanir: 0}
];

self.InstanceType = {
	tahta: class extends self.ISpriteInstance {},
	arkafon: class extends self.ISpriteInstance {},
	DrawingCanvas: class extends self.IDrawingCanvasInstance {},
	alt: class extends self.ISpriteInstance {},
	ust: class extends self.ISpriteInstance {},
	nasiloynanir: class extends self.ISpriteInstance {}
}