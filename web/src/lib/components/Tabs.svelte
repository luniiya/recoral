<script lang="ts">
	interface Tab {
		value: string;
		label: string;
	}

	interface Props {
		tabs: Tab[];
		active: string;
		onselect: (value: string) => void;
	}

	let { tabs, active, onselect }: Props = $props();
</script>

<!-- Generic pill-tab bar, lifted out of what used to be hand-duplicated markup
     (RecordingDetail's Audio/Transcription toggle, this project's own theme
     picker). Pure controlled component: active state and click handling are
     both owned by the caller, so it works equally for a local $state toggle
     or for navigation-backed tabs (onselect calling goto()). -->
<div class="inline-flex rounded-full bg-black/5 p-1 dark:bg-white/10">
	{#each tabs as tab (tab.value)}
		<button
			type="button"
			class="rounded-full px-4 py-1.5 text-sm font-medium transition
				{active === tab.value
				? 'bg-accent-500 text-white'
				: 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'}"
			onclick={() => onselect(tab.value)}
		>
			{tab.label}
		</button>
	{/each}
</div>
