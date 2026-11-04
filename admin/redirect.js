/* GitHub Pages is static: /api does not exist there, so send admin to Vercel. */
if (location.hostname.endsWith("github.io")) {
  location.replace("https://dianatattoostudio.com/admin/");
}
