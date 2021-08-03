document.addEventListener("DOMContentLoaded", () => { 
    const images = [...document.querySelectorAll(".figure img")];
    for (const image of images) {
      const wrap = document.createElement('a');
      wrap.classList.add("img-wrap")
      wrap.setAttribute("href", image.src);
      image.parentElement.insertBefore(wrap, image);
      wrap.appendChild(image);
    }
    Chocolat(document.querySelectorAll('.figure .img-wrap'));
})
