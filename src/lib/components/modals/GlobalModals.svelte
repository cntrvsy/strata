<!--
  GlobalModals.svelte

  Summary: Mounts all application modal dialogs and handles top-level reactive notifications.
  Expects: None (shares global schemaState).
  Output: Renders active dialogs and global notifications.
-->
<script lang="ts">
  import { schemaState } from "#lib/state";
  import { toast } from "svelte-sonner";
  import ProjectSettingsModal from "./ProjectSettingsModal.svelte";
  import RenameEntityModal from "./RenameEntityModal.svelte";
  import ConfirmModal from "./ConfirmModal.svelte";
  import ScaffoldAuthModal from "./ScaffoldAuthModal.svelte";
  import NewEntityModal from "#lib/components/forms/entity/NewEntityModal.svelte";
  import CodeViewerModal from "./CodeViewerModal.svelte";

  // Watch for critical errors
  $effect(() => {
    if (schemaState.machine.current === "ERROR") {
      if (schemaState.packageWrapperInfo) {
        toast.dismiss("error-toast");
        return;
      }
      const isDisk = schemaState.errorType === "disk";
      const isMutation = schemaState.errorType === "mutation";
      const title = isDisk
        ? "Failed to Save: Disk Write Error"
        : isMutation
          ? "Schema Modification Error"
          : "Sync Paused: Parse Error";

      toast.error(title, {
        id: "error-toast",
        description: schemaState.error || "An unexpected error occurred",
        duration: Infinity,
        action: isMutation
          ? undefined
          : {
              label: "Retry",
              onClick: () => {
                if (isDisk) {
                  schemaState.saveToFile();
                } else {
                  schemaState.syncWithFile();
                }
              },
            },
        cancel: {
          label: isMutation ? "Dismiss" : "Open Different",
          onClick: () => {
            if (isMutation) {
              toast.dismiss("error-toast");
            } else {
              schemaState.openNewFile();
            }
          },
        },
      });
    } else {
      toast.dismiss("error-toast");
    }
  });

  // Watch for export toast
  $effect(() => {
    if (schemaState.showExportToast) {
      toast.success("Export Successful", {
        description: "Check your Downloads folder for the PNG diagram",
      });
      schemaState.showExportToast = false;
    }
  });
</script>

<NewEntityModal />
<ScaffoldAuthModal />
<ProjectSettingsModal />
<RenameEntityModal />
<ConfirmModal />
<CodeViewerModal />
