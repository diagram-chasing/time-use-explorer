<script lang="ts">
	import {
		Database,
		BarChart,
		Clock,
		Plus,
		Trash,
		Info,
		ChevronDown,
		FileQuestion
	} from 'lucide-svelte';
	import FilterControls from './FilterControls.svelte';
	import Selector from './Selector.svelte';
	import ActionButton from './ActionButton.svelte';
	import { getAppContext } from '$lib/utils/context';
	import { VIEW_MODES, allColumns, specialColumns } from '$lib/utils/constants';

	// Get the app context directly
	const {
		loading,
		dbReady,
		viewMode,
		selectedColumns,
		filters,
		demographicColumns,
		activityColumn,
		aggregations,
		groupByColumns,
		setViewMode,
		executeRawDataQuery,
		executeSummaryQuery,
		executeTimeAnalysis,
		toggleColumn,
		addFilter,
		removeFilter,
		addAggregation,
		removeAggregation,
		toggleGroupByColumn,
		toggleDemographicColumn,
		useWeights
	} = getAppContext();

	// Tooltip state
	let tooltipVisible = -1;

	// Function to handle tooltip toggle
	function toggleTooltip(index: number) {
		tooltipVisible = tooltipVisible === index ? -1 : index;
	}

	$: timeAnalysisMode = $viewMode === VIEW_MODES.TIME_ANALYSIS;
	$: summaryMode = $viewMode === VIEW_MODES.SUMMARY;
	$: rawDataMode = $viewMode === VIEW_MODES.RAW_DATA;

	// Get current action, icon and label based on view mode
	$: queryAction = timeAnalysisMode
		? executeTimeAnalysis
		: summaryMode
			? executeSummaryQuery
			: executeRawDataQuery;

	$: queryIcon = timeAnalysisMode
		? ('clock' as const)
		: summaryMode
			? ('chart' as const)
			: ('search' as const);

	$: queryLabel = timeAnalysisMode ? 'Analyze Time' : summaryMode ? 'Run Summary' : 'Run Query';

	// Format columns for selector components
	$: formattedColumns = allColumns
		.filter((col) => !col.hidden)
		.map((col) => ({
			id: col.id,
			label: col.label
		}));

	// Format special columns for selector components
	$: formattedSpecialColumns = specialColumns.map((col) => ({
		id: col.id,
		label: col.label,
		description: col.description
	}));

	function handleAboutClick() {
		setViewMode(VIEW_MODES.ABOUT);
	}
</script>

<!-- Sidebar controls -->
<div class="flex h-full flex-col">
	<!-- About section in raw data mode - will appear first on mobile but last on desktop -->
	{#if rawDataMode}
		<div
			class="bg-base-100 border-neutral order-first mb-2 space-y-2 border p-3 lg:order-last lg:mt-2 lg:mb-0"
		>
			<div class="flex flex-col gap-2">
				<h3 class="text-xs font-semibold">Explore the National Time Use Survey</h3>
				<p class="text-neutral text-xs" style="font-family: var(--font-ui);">
					The National Time Use Survey (NTUS) contains detailed time use information collected from
					individuals across India, showing how people spend their time across various activities
					like work, leisure, and household duties. Each record represents a single activity with
					its duration and contextual information about the person.
				</p>
				<p class="text-neutral text-xs" style="font-family: var(--font-ui);">
					This explorer lets you subset, filter, and create summaries of the entire 10 million+
					records in the NTUS all in your browser.
				</p>
			</div>
			<div class="flex gap-2">
				<button
					on:click={handleAboutClick}
					class="text-neutral bg-neutral flex items-center gap-1 px-2 py-1 text-xs text-white"
					style="font-family: var(--font-ui);"
				>
					<FileQuestion class="h-3 w-3" />
					How to use
				</button>
				<a
					href="https://github.com/Vonter/india-timeuse-survey/blob/main/DATA.md"
					target="_blank"
					class="text-neutral bg-neutral flex items-center gap-1 px-2 py-1 text-xs text-white"
					style="font-family: var(--font-ui);"
				>
					<Info class="h-3 w-3" />
					Data Dictionary
				</a>
			</div>
		</div>
	{/if}

	<!-- Main controls (filters, etc) -->
	<div
		class="bg-base-100 border {rawDataMode
			? 'lg:min-h-[350px]'
			: 'lg:min-h-[300px]'} border-neutral order-last flex flex-1 flex-col overflow-y-auto lg:order-first"
	>
		<details class="group flex flex-1 flex-col lg:hidden" open>
			<summary
				class="bg-base-200 border-neutral/20 flex cursor-pointer items-center justify-between border-b p-3 text-xs font-semibold"
			>
				Controls
				<ChevronDown class="h-3 w-3 transition-transform duration-200 group-open:rotate-180" />
			</summary>
			<div class="flex-grow overflow-y-auto p-3">
				<!-- Mode-specific controls -->
				{#if timeAnalysisMode}
					<!-- Time Analysis Settings -->
					<p
						class="text-neutral border-neutral mb-3 border-b pb-2 text-xs"
						style="font-family: var(--font-ui);"
					>
						Select demographic columns to group by for calculating average and total time spent on
						activities.
					</p>
					<div class="mb-4">
						<div class="space-y-3">
							<!-- Demographic column selection -->
							<Selector
								type="button"
								label="Group By"
								options={formattedColumns.filter((col) => col.id !== $activityColumn)}
								selectedValues={$demographicColumns}
								onChange={toggleDemographicColumn}
								size="sm"
							/>

							<!-- Use weights toggle -->
							<div class="form-control">
								<label class="label mt-1 cursor-pointer justify-start gap-3 p-0">
									<input
										type="checkbox"
										class="toggle toggle-sm toggle-primary"
										bind:checked={$useWeights}
										on:change={executeTimeAnalysis}
									/>
									<span class="label-text text-xs">Use geographically weighted average</span>
								</label>
								<p class="text-base-300 mt-1 ml-10 text-[10px]">
									When enabled, uses survey weights (mult) for more accurate national
									representation
								</p>
							</div>
						</div>
					</div>
				{:else if summaryMode}
					<!-- Summary Settings -->
					<div class="mb-4">
						<p
							class="text-neutral border-neutral mb-3 border-b pb-2 text-xs"
							style="font-family: var(--font-ui);"
						>
							Select columns to aggregate and functions to apply. Useful for exploring different
							dimensions of the data.
						</p>

						<div class="space-y-3">
							<!-- Aggregations -->
							<div class="mt-2">
								<div class="flex w-full justify-between">
									<p class="control-label">AGGREGATION FUNCTIONS</p>
								</div>
								<div class="space-y-2">
									{#each $aggregations as agg, i}
										<div
											class="flex items-center gap-1.5 {i < $aggregations.length - 1
												? 'border-neutral/10 mb-2 border-b border-dashed pb-2'
												: ''}"
										>
											<div class="relative flex-grow">
												<div class="flex items-center gap-1.5">
													<Selector
														type="dropdown"
														dropdownValue={agg.function}
														dropdownOptions={formattedSpecialColumns}
														onDropdownChange={(value) => {
															agg.function = value;
														}}
														size="sm"
													/>
												</div>
											</div>

											<Selector
												type="dropdown"
												dropdownValue={agg.column}
												dropdownOptions={[{ id: '*', label: 'All (*)' }, ...formattedColumns]}
												onDropdownChange={(value) => {
													agg.column = value;
												}}
												size="sm"
											/>
											<button
												on:click={() => removeAggregation(i)}
												class="border-neutral text-neutral hover:border-red hover:text-red mt-auto border p-1 transition-colors"
											>
												<Trash class="h-3 w-3" />
											</button>
										</div>
									{/each}
								</div>
								<button
									on:click={addAggregation}
									class="border-neutral text-neutral hover:bg-neutral mt-2 flex items-center gap-1 border px-2 py-1 text-xs hover:text-white"
								>
									<Plus class="h-3 w-3" /> Add Aggregation
								</button>
							</div>

							<!-- Group By Columns -->
							<Selector
								type="button"
								label="GROUP BY COLUMNS"
								options={formattedColumns}
								selectedValues={$groupByColumns}
								onChange={toggleGroupByColumn}
								size="sm"
							/>
						</div>
					</div>
				{:else}
					<!-- Column selection for raw data mode -->
					<p
						class="text-neutral border-neutral mb-3 border-b pb-2 text-xs"
						style="font-family: var(--font-ui);"
					>
						Explore the original data by selecting columns to display in the table.
					</p>
					<div class="mb-4">
						<div class="control-label">SELECT COLUMNS</div>
						<div class="max-h-48 overflow-y-auto pr-1">
							<div class="grid grid-cols-2 gap-x-2">
								{#each allColumns as column}
									{#if !column.hidden}
										<div class="mb-0.5 flex items-center">
											<input
												type="checkbox"
												id={`col-${column.id}`}
												checked={$selectedColumns.includes(column.id)}
												on:change={() => toggleColumn(column.id)}
												class="mr-2"
											/>
											<label
												for={`col-${column.id}`}
												class="text-xs"
												style="font-family: var(--font-ui);">{column.label}</label
											>
										</div>
									{/if}
								{/each}
							</div>
						</div>
					</div>
				{/if}

				<!-- Common controls -->
				<FilterControls
					{allColumns}
					filters={$filters}
					onAdd={addFilter}
					onRemove={removeFilter}
					onChange={(index, field, value) => {
						if ($filters[index]) {
							if (field === 'column') $filters[index].column = value;
							if (field === 'operator') $filters[index].operator = value;
							if (field === 'value') $filters[index].value = value;
							if (field === 'enabled') $filters[index].enabled = value;
						}
					}}
				/>
			</div>

			<!-- Query buttons for mobile (inside collapsible section) -->
			<div class="bg-base-100 sticky bottom-0 flex w-full flex-col p-1 lg:hidden">
				<ActionButton
					onClick={queryAction}
					loading={$loading}
					disabled={$loading || !$dbReady}
					icon={queryIcon}
					label={queryLabel}
					variant="primary"
				/>
			</div>
		</details>

		<!-- Non-collapsible content for desktop (lg screens and up) -->
		<div class="hidden flex-grow overflow-y-auto p-3 lg:block">
			<!-- Mode-specific controls -->
			{#if timeAnalysisMode}
				<!-- Time Analysis Settings -->
				<p
					class="text-neutral border-neutral mb-3 border-b pb-2 text-xs"
					style="font-family: var(--font-ui);"
				>
					Select demographic columns to group by for calculating average and total time spent on
					activities.
				</p>
				<div class="mb-4">
					<div class="space-y-3">
						<!-- Demographic column selection -->
						<Selector
							type="button"
							label="Group By"
							options={formattedColumns.filter((col) => col.id !== $activityColumn)}
							selectedValues={$demographicColumns}
							onChange={toggleDemographicColumn}
							size="sm"
						/>

						<!-- Use weights toggle -->
						<div class="form-control">
							<label class="label mt-1 cursor-pointer items-center justify-center gap-3 p-0">
								<input
									type="checkbox"
									class="toggle toggle-xs toggle-primary size-3"
									bind:checked={$useWeights}
								/>
								<span class="label-text mb-1 text-[10px]">Use weights</span>
							</label>
						</div>
					</div>
				</div>
			{:else if summaryMode}
				<!-- Summary Settings -->
				<div class="mb-4">
					<p
						class="text-neutral border-neutral mb-3 border-b pb-2 text-xs"
						style="font-family: var(--font-ui);"
					>
						Select columns to aggregate and functions to apply. Useful for exploring different
						dimensions of the data.
					</p>

					<div class="space-y-3">
						<!-- Aggregations -->
						<div class="mt-2">
							<div class="flex w-full justify-between">
								<p class="control-label">AGGREGATION FUNCTIONS</p>
							</div>
							<div class="space-y-2">
								{#each $aggregations as agg, i}
									<div
										class="flex items-center gap-1.5 {i < $aggregations.length - 1
											? 'border-neutral/10 mb-2 border-b border-dashed pb-2'
											: ''}"
									>
										<div class="relative flex-grow">
											<div class="flex items-center gap-1.5">
												<Selector
													type="dropdown"
													dropdownValue={agg.function}
													dropdownOptions={formattedSpecialColumns}
													onDropdownChange={(value) => {
														agg.function = value;
													}}
													size="sm"
												/>
											</div>
										</div>

										<Selector
											type="dropdown"
											dropdownValue={agg.column}
											dropdownOptions={[{ id: '*', label: 'All (*)' }, ...formattedColumns]}
											onDropdownChange={(value) => {
												agg.column = value;
											}}
											size="sm"
										/>
										<button
											on:click={() => removeAggregation(i)}
											class="border-neutral text-neutral hover:border-red hover:text-red mt-auto border p-1 transition-colors"
										>
											<Trash class="h-3 w-3" />
										</button>
									</div>
								{/each}
							</div>
							<button
								on:click={addAggregation}
								class="border-neutral text-neutral hover:bg-neutral mt-2 flex items-center gap-1 border px-2 py-1 text-xs hover:text-white"
							>
								<Plus class="h-3 w-3" /> Add Aggregation
							</button>
						</div>

						<!-- Group By Columns -->
						<Selector
							type="button"
							label="GROUP BY COLUMNS"
							options={formattedColumns}
							selectedValues={$groupByColumns}
							onChange={toggleGroupByColumn}
							size="sm"
						/>
					</div>
				</div>
			{:else}
				<!-- Column selection for raw data mode -->
				<p
					class="text-neutral border-neutral mb-3 border-b pb-2 text-xs"
					style="font-family: var(--font-ui);"
				>
					Explore the original data by selecting columns to display in the table.
				</p>
				<div class="mb-4">
					<div class="control-label">SELECT COLUMNS</div>
					<div class="max-h-48 overflow-y-auto pr-1">
						<div class="grid grid-cols-2 gap-x-2">
							{#each allColumns as column}
								{#if !column.hidden}
									<div class="mb-0.5 flex items-center">
										<input
											type="checkbox"
											id={`col-${column.id}-desktop`}
											checked={$selectedColumns.includes(column.id)}
											on:change={() => toggleColumn(column.id)}
											class="mr-2"
										/>
										<label
											for={`col-${column.id}-desktop`}
											class="text-xs"
											style="font-family: var(--font-ui);">{column.label}</label
										>
									</div>
								{/if}
							{/each}
						</div>
					</div>
				</div>
			{/if}

			<!-- Common controls -->
			<FilterControls
				{allColumns}
				filters={$filters}
				onAdd={addFilter}
				onRemove={removeFilter}
				onChange={(index, field, value) => {
					if ($filters[index]) {
						if (field === 'column') $filters[index].column = value;
						if (field === 'operator') $filters[index].operator = value;
						if (field === 'value') $filters[index].value = value;
						if (field === 'enabled') $filters[index].enabled = value;
					}
				}}
			/>
		</div>

		<!-- Query buttons for desktop only -->
		<div class="bg-base-100 sticky bottom-0 hidden w-full flex-col p-1 lg:flex">
			<ActionButton
				onClick={queryAction}
				loading={$loading}
				disabled={$loading || !$dbReady}
				icon={queryIcon}
				label={queryLabel}
				variant="primary"
			/>
		</div>
	</div>
</div>
