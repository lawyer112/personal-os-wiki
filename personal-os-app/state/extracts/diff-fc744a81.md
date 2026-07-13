diff --git a/personal-os-app/scripts/github-radar-intake.mjs b/personal-os-app/scripts/github-radar-intake.mjs
index 5392df3..4154ed7 100644
--- a/personal-os-app/scripts/github-radar-intake.mjs
+++ b/personal-os-app/scripts/github-radar-intake.mjs
@@ -365,6 +365,7 @@ function buildIntakePayload({ markdown, tasks, repos, includeTasks, taskId }) {
     },
     wikiNotes: [
       {
+        title: `GitHub 知识雷达 ${now.slice(0, 10)} Personal OS Wiki 自驱候选`,
         frontmatter: {
           title: `GitHub 知识雷达 ${now.slice(0, 10)} Personal OS Wiki 自驱候选`,
           type: "project",
