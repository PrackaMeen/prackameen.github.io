# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: button-hitbox.spec.ts >> Settings button opens the settings scene
- Location: tests\playwright\button-hitbox.spec.ts:196:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "settings"
Received: "demo"

Call Log:
- Timeout 5000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- generic "Excalibur demo game" [ref=e3]
```

# Test source

```ts
  288 | 
  289 |     if (!loopVisualButtonBounds) {
  290 |       throw new Error("Expected to find the visible Settings button in the screenshot");
  291 |     }
  292 | 
  293 |     const loopVisualButtonBox = {
  294 |       left: loopCanvasBox.x + loopVisualButtonBounds.left * (loopCanvasBox.width / loopCanvasScreenshot.width),
  295 |       top: loopCanvasBox.y + loopVisualButtonBounds.top * (loopCanvasBox.height / loopCanvasScreenshot.height),
  296 |       right: loopCanvasBox.x + loopVisualButtonBounds.right * (loopCanvasBox.width / loopCanvasScreenshot.width),
  297 |       bottom: loopCanvasBox.y + loopVisualButtonBounds.bottom * (loopCanvasBox.height / loopCanvasScreenshot.height)
  298 |     };
  299 | 
  300 |     console.log(JSON.stringify({
  301 |       loopCanvasBox,
  302 |       screenshot: { width: loopCanvasScreenshot.width, height: loopCanvasScreenshot.height },
  303 |       loopVisualButtonBounds,
  304 |       loopVisualButtonBox
  305 |     }));
  306 | 
  307 |     const cornerClicks = [
  308 |       { x: loopVisualButtonBox.left + 1, y: Math.round(loopVisualButtonBox.top) },
  309 |       { x: loopVisualButtonBox.right - 1, y: Math.round(loopVisualButtonBox.top) },
  310 |       { x: loopVisualButtonBox.right - 1, y: Math.round(loopVisualButtonBox.bottom) - 1 },
  311 |       { x: loopVisualButtonBox.left + 1, y: Math.round(loopVisualButtonBox.bottom) - 1 }
  312 |     ];
  313 | 
  314 |     const { x, y } = cornerClicks[index];
  315 |     const pageX = x;
  316 |     const pageY = y;
  317 | 
  318 |     console.log(JSON.stringify({ pageX, pageY }));
  319 | 
  320 |     await addPointMarker(page, pageX, pageY, index, "visual", {
  321 |       size: 12,
  322 |       background: "rgba(34, 197, 94, 0.18)",
  323 |       border: "2px solid rgba(34, 197, 94, 0.98)",
  324 |       boxShadow: "0 0 0 2px rgba(16, 185, 129, 0.28)"
  325 |     });
  326 | 
  327 |     const screenshotPath = testInfo.outputPath(`settings-corner-${index + 1}-${Math.round(x)}-${Math.round(y)}.png`);
  328 |     await page.evaluate(({ pageX, pageY }) => {
  329 |       (globalThis as typeof globalThis & { __lastMenuPointer?: { x: number; y: number }; __lastMenuHitTarget?: string | null }).__lastMenuPointer = undefined;
  330 |       (globalThis as typeof globalThis & { __lastMenuPointer?: { x: number; y: number }; __lastMenuHitTarget?: string | null }).__lastMenuHitTarget = undefined;
  331 | 
  332 |       const canvas = document.querySelector("canvas#game");
  333 | 
  334 |       if (!canvas) {
  335 |         throw new Error("Expected the game canvas to be present");
  336 |       }
  337 | 
  338 |       const bounds = canvas.getBoundingClientRect();
  339 |       const clientX = bounds.left + pageX;
  340 |       const clientY = bounds.top + pageY;
  341 |       const dispatch = (type: string, buttons: number) => {
  342 |         canvas.dispatchEvent(new PointerEvent(type, {
  343 |           bubbles: true,
  344 |           pointerId: 1,
  345 |           pointerType: "mouse",
  346 |           isPrimary: true,
  347 |           button: 0,
  348 |           buttons,
  349 |           clientX,
  350 |           clientY
  351 |         }));
  352 |       };
  353 | 
  354 |       dispatch("pointermove", 0);
  355 |       dispatch("pointerdown", 1);
  356 |       dispatch("pointerup", 0);
  357 |     }, { pageX, pageY });
  358 | 
  359 |     const clickState = await page.evaluate(() => ({
  360 |       hitTarget: (globalThis as typeof globalThis & { __lastMenuHitTarget?: string | null }).__lastMenuHitTarget ?? null,
  361 |       pointer: (globalThis as typeof globalThis & { __lastMenuPointer?: { x: number; y: number } }).__lastMenuPointer ?? null,
  362 |       activeScene: (globalThis as typeof globalThis & { __activeSceneName?: string }).__activeSceneName ?? null
  363 |     }));
  364 | 
  365 |     if (clickState.pointer) {
  366 |       await addPointMarker(page, clickState.pointer.x, clickState.pointer.y, index, "click", {
  367 |         size: 8,
  368 |         background: "rgba(239, 68, 68, 0.98)",
  369 |         border: "2px solid rgba(153, 27, 27, 1)",
  370 |         boxShadow: "0 0 0 2px rgba(255, 255, 255, 0.55)"
  371 |       });
  372 |     }
  373 | 
  374 |     await page.screenshot({
  375 |       path: screenshotPath,
  376 |       clip: {
  377 |         x: Math.max(0, loopVisualButtonBox.left - 12),
  378 |         y: Math.max(0, loopVisualButtonBox.top - 12),
  379 |         width: (loopVisualButtonBox.right - loopVisualButtonBox.left) + 24,
  380 |         height: (loopVisualButtonBox.bottom - loopVisualButtonBox.top) + 24
  381 |       }
  382 |     });
  383 |     await testInfo.attach(`settings-corner-${index + 1}`, {
  384 |       path: screenshotPath,
  385 |       contentType: "image/png"
  386 |     });
  387 | 
> 388 |     await expect.poll(async () => page.evaluate(() => (globalThis as typeof globalThis & { __activeSceneName?: string }).__activeSceneName ?? null)).toBe("settings");
      |                                                                                                                                                      ^ Error: expect(received).toBe(expected) // Object.is equality
  389 |     if (clickState.hitTarget !== null) {
  390 |       expect(
  391 |         clickState.hitTarget,
  392 |         `expected the visible corner click to hit Settings, got ${clickState.hitTarget} at pointer ${clickState.pointer ? `${clickState.pointer.x},${clickState.pointer.y}` : "<missing>"} from intended ${pageX},${pageY}`
  393 |       ).toBe("settings");
  394 |     }
  395 |   }
  396 | });
```