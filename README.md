# Hipster Pixel

Web-app prototype for pixeling using triangular pixels, supporting multiple tilings.

![screencap gif - pixeling with triangles](hipster-pixel.gif)

[**Start Pixeling!**](https://teadrinker.github.io/hipster-pixel)

[**Watch Presentation Video**](https://www.youtube.com/watch?v=C0YHuGWPhqs)

## Beware

I seemed to be using this project several times each year even though the 
original prototype did not even have a way to save the results (was doing printscreen)

So I figured it should be useful despite its issues, and spent a few days getting
basic state, export and UI working. But it still has some issues...

## Rendering issues

It would be complex (and computationally heavy) to treat the entire drawing as a polygon which we do union/subtraction on.
Instead, we split the drawing into rows, drawing each separately. The core problem is that the transitions between the rows are never seamless.
In many cases the grid and the background noise helps to make them less noticable, but depending on browser and canvas implementations, rendering issues can range from minor to severe.

A shader/gpu based renderer would be much faster and more robust, but for svg export you would still need a separate vertex based backend.

## Export issues

Both svg and png export use the current canvas resolution.
Not ideal, but you can kind of adjust this by just changing the browser zoom level.

Svg paths are divided into rows (as they are rendered), so
you might want to merge/union them in a vector editor like Inkscape to avoid artifacts.

## Lessons Learned...

This project was mostly done in 2012, in the early days of multitouch, and was soon abandoned. 
Part of the reason was the rendering method and the differences between canvas implementations.
I also had ambitions like color and layer support.

Another factor is that using a fixed tiling was often more annoying than I had
hoped, ideally you want a more dynamic/smart tesselation, or a "selectively hierarchical"
tiling... 

## Resused Resources

 * Dual svg/canvas backend from [Mad Tea Lab](https://madtealab.com)
 * Font: [Idealist Hacker Mono](https://github.com/teadrinker/idealist-hacker-mono-font)

