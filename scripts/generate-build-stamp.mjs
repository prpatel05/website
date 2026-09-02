import { writeBuildStamp } from "./build-stamp.mjs";

// Last step of the build, so the stamp identifies a finished dist/ rather than
// one prerender or the sitemap generator is still writing into.
const { id, path } = writeBuildStamp();
console.log(`Build stamp generated: ${path} (${id})`);
