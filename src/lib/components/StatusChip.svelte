<script>
  import { STATUS_LABELS } from '$lib/labels.js';

  const CHIP_CLASS = {
    pending: 'chip-warning',
    faculty_ack: 'chip-neutral',
    advisor_pending: 'chip-neutral',
    advisor_ack: 'chip-indigo',
    faculty_review: 'chip-neutral',
    iad_pending: 'chip-neutral',
    iad_ack: 'chip-indigo',
    iad_dir_pending: 'chip-neutral',
    processing: 'chip-warning',
    completed: 'chip-success',
    rejected: 'chip-error',
    terminated: 'chip-neutral'
  };

  export let status;
  $: label = STATUS_LABELS[status] || status;
  $: cls = CHIP_CLASS[status] || 'chip-neutral';
</script>

<span class="chip {cls}">{label}</span>
