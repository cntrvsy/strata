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
  import ScaffoldArchitectureModal from "./ScaffoldArchitectureModal.svelte";
  import NewEntityModal from "#lib/components/forms/entity/NewEntityModal.svelte";

  // Watch for critical errors
  $effect(() => {
    if (schemaState.machine.current === "ERROR") {
      const isDisk = schemaState.errorType === "disk";
      toast.error(
        isDisk ? "Failed to Save: Disk Write Error" : "Sync Paused: Parse Error",
        {
          id: "error-toast",
          description: schemaState.error || "An unexpected error occurred",
          duration: Infinity,
          action: {
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
            label: "Open Different",
            onClick: () => {
              schemaState.openNewFile();
            },
          },
        }
      );
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
<ScaffoldArchitectureModal />
<ProjectSettingsModal />
<RenameEntityModal />
<ConfirmModal />
