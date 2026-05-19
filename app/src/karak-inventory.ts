export interface KarakInventoryStoreResult {
	items: string[];
	stored: boolean;
	droppedItem: string | null;
	slotIndex: number | null;
}

export function resolveKarakInventoryAdd(currentItems: readonly string[], itemId: string, capacity: number): KarakInventoryStoreResult {
	const normalizedCapacity = Math.max(0, Math.floor(capacity));

	if (currentItems.length >= normalizedCapacity) {
		return {
			items: [...currentItems],
			stored: false,
			droppedItem: itemId,
			slotIndex: null
		};
	}

	const slotIndex = currentItems.length;

	return {
		items: [...currentItems, itemId],
		stored: true,
		droppedItem: null,
		slotIndex
	};
}