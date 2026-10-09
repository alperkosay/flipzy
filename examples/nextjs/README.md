# flipzy Next.js example

Two pages:

- `/` — a book made of React elements, with light and dark themes
- `/pdf` — a book made from `public/sample.pdf`, rendered page by page with pdf.js ([app/PdfBook.tsx](./app/PdfBook.tsx))

```bash
# in the repository root
npm run build
# here
cd examples/nextjs
npm install --ignore-scripts
npm run dev
```

To show your own PDF, put it in `public/` and change the `url` in [app/pdf/page.tsx](./app/pdf/page.tsx).
PDFs from another domain need that server to allow CORS.

After changing the library, run `npm run build` in the root again and restart `npm run dev`.
