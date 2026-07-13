
> personal-os-app@0.1.1 build
> next build

⚠ Warning: Next.js inferred your workspace root, but it may not be correct.
 We detected multiple lockfiles and selected the directory of /Users/xingqiwu/package-lock.json as the root directory.
 To silence this warning, set `turbopack.root` in your Next.js config, or consider removing one of the lockfiles if it's not needed.
   See https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack#root-directory for more information.
 Detected additional lockfiles: 
   * /Users/xingqiwu/Documents/New project 5/personal-os-wiki/personal-os-app/package-lock.json

▲ Next.js 16.2.7 (Turbopack)

  Creating an optimized production build ...
✓ Compiled successfully in 1782ms
  Running TypeScript ...
  Finished TypeScript in 2.1s ...
  Collecting page data using 9 workers ...
Error: DATABASE_URL is required
    at <unknown> (.next/server/chunks/Documents_New project 5_personal-os-wiki_personal-os-app_1ndym-1._.js:1:23977)
    at <unknown> (.next/server/chunks/Documents_New project 5_personal-os-wiki_personal-os-app_1ndym-1._.js:1:24020)

> Build error occurred
Error: Failed to collect page data for /api/agent/runs/[id]/complete
    at ignore-listed frames {
  type: 'Error'
}
