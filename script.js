const menuBtn = document.getElementById("menuBtn");
const navMenu = document.getElementById("navMenu");
const navLinks = document.querySelectorAll(".nav a");
const reveals = document.querySelectorAll(".reveal");

menuBtn.addEventListener("click", () => {
  navMenu.classList.toggle("open");
});

navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    navMenu.classList.remove("open");
  });
});

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add("show");
    });
  },
  { threshold: 0.15 }
);

reveals.forEach((el) => observer.observe(el));

window.addEventListener("scroll", () => {
  const header = document.querySelector(".header");
  if (window.scrollY > 10) {
    header.style.boxShadow = "0 10px 30px rgba(0,0,0,0.28)";
  } else {
    header.style.boxShadow = "none";
  }
});