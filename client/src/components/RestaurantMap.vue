<script setup lang="ts">
import { reactive, onUnmounted, computed } from 'vue'
import type { MasterTable, Room, SubType, TableUpdatePayload } from '../../../models/src'
import SubTypeSummary from "@/components/SubTypeSummary.vue"
import { useDisplay } from 'vuetify'

const { smAndUp } = useDisplay()

const props = defineProps<{
  room: Room | undefined
  tables: MasterTable[]
  zoom: number
  selectedTableId: number
  editable?: boolean
  highlightSelection?: boolean
  types?: SubType[]
}>()

const emit = defineEmits<{
  (e: 'click-table', table: MasterTable): void
  (e: 'update-table', payload: TableUpdatePayload): void
}>()

let rafId: number | null = null

const draggingState = reactive({
  isDragging: false,
  hasMoved: false,
  startX: 0,
  startY: 0,
  initialTableX: 0,
  initialTableY: 0,
  activeTableId: null as number | null,
  currentX: 0,
  currentY: 0
})

const activeTables = computed(() => {
  if (!props.room) return []
  return props.tables.filter(t => t.room_id === props.room!.id)
})

const updatePosition = (clientX: number, clientY: number) => {
  if (!draggingState.isDragging || !draggingState.activeTableId || !props.room) return

  const deltaXPixels = clientX - draggingState.startX
  const deltaYPixels = clientY - draggingState.startY

  if (Math.abs(deltaXPixels) > 2 || Math.abs(deltaYPixels) > 2) {
    draggingState.hasMoved = true
  }

  const deltaXCm = deltaXPixels / props.zoom
  const deltaYCm = deltaYPixels / props.zoom

  const currentTable = props.tables.find(t => t.id === draggingState.activeTableId)
  if (!currentTable) return

  let newX = draggingState.initialTableX + deltaXCm
  let newY = draggingState.initialTableY + deltaYCm

  const gridSize = 5
  newX = Math.round(newX / gridSize) * gridSize
  newY = Math.round(newY / gridSize) * gridSize

  const roomWidthCm = props.room.width * 100
  const roomHeightCm = props.room.height * 100

  draggingState.currentX = Math.max(0, Math.min(newX, roomWidthCm - currentTable.width))
  draggingState.currentY = Math.max(0, Math.min(newY, roomHeightCm - currentTable.height))
}

const startDrag = (event: MouseEvent, table: MasterTable) => {
  if (!props.editable || event.button !== 0) return

  prepareDragState(table, event.clientX, event.clientY)

  window.addEventListener('mousemove', onGlobalMouseMove)
  window.addEventListener('mouseup', onGlobalMouseUp)
}

const onGlobalMouseMove = (event: MouseEvent) => {
  if (rafId) return
  rafId = requestAnimationFrame(() => {
    updatePosition(event.clientX, event.clientY)
    rafId = null
  })
}

const onGlobalMouseUp = () => {
  finishDrag()
}

const startTouchDrag = (event: TouchEvent, table: MasterTable) => {
  if (!props.editable || event.touches.length !== 1) return

  const touch = event.touches[0]
  prepareDragState(table, touch.clientX, touch.clientY)

  window.addEventListener('touchmove', onGlobalTouchMove, { passive: false })
  window.addEventListener('touchend', onGlobalTouchEnd)
  window.addEventListener('touchcancel', onGlobalTouchEnd)
}

const onGlobalTouchMove = (event: TouchEvent) => {
  if (event.cancelable) event.preventDefault()

  if (rafId) return
  const touch = event.touches[0]
  rafId = requestAnimationFrame(() => {
    updatePosition(touch.clientX, touch.clientY)
    rafId = null
  })
}

const onGlobalTouchEnd = (event: TouchEvent) => {
  finishDrag()
}

const finishDrag = () => {
  if (draggingState.activeTableId && draggingState.hasMoved) {
    emit('update-table', {
      id: draggingState.activeTableId,
      x: draggingState.currentX,
      y: draggingState.currentY
    })
  } else if (draggingState.activeTableId && !draggingState.hasMoved) {
    const table = props.tables.find(t => t.id === draggingState.activeTableId)
    if (table) emit('click-table', table)
  }
  cleanupListeners()
}

const prepareDragState = (table: MasterTable, clientX: number, clientY: number) => {
  draggingState.isDragging = true
  draggingState.hasMoved = false
  draggingState.activeTableId = table.id
  draggingState.startX = clientX
  draggingState.startY = clientY
  draggingState.initialTableX = table.x
  draggingState.initialTableY = table.y
  draggingState.currentX = table.x
  draggingState.currentY = table.y
}

const cleanupListeners = () => {
  draggingState.isDragging = false
  draggingState.activeTableId = null
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = null
  }

  window.removeEventListener('mousemove', onGlobalMouseMove)
  window.removeEventListener('mouseup', onGlobalMouseUp)

  window.removeEventListener('touchmove', onGlobalTouchMove)
  window.removeEventListener('touchend', onGlobalTouchEnd)
  window.removeEventListener('touchcancel', onGlobalTouchEnd)
}

const handleTableClick = (table: MasterTable) => {
  if (!draggingState.hasMoved) {
    emit('click-table', table)
  }
}

onUnmounted(() => {
  cleanupListeners()
})
</script>

<template>
  <div class="viewport-scroller bg-grey-lighten-3" style="max-height: calc(100vh - 112px)">
    <div :class="{ 'canvas-centering-wrapper': smAndUp }" style="width: 100%">
      <div v-if="room && room.id > 0" class="room-scaler" :style="{
        width: (room.width * 100 * zoom) + 'px',
        height: (room.height * 100 * zoom) + 'px'
      }">
        <div class="room-floor elevation-3" :style="{
          width: (room.width * 100) + 'px',
          height: (room.height * 100) + 'px',
          transform: `scale(${zoom})`
        }">
          <div class="grid-overlay"></div>

          <div v-for="table in activeTables" :key="table.id" class="table-item d-flex align-center justify-center elevation-2"
            :class="{
              'rounded-circle': table.shape === 'circle',
              'rounded': table.shape === 'rect',
              'cursor-grab': editable,
              'cursor-pointer': !editable,
              'in-use': table.inUse,
              'is-dragging': draggingState.activeTableId === table.id
            }" :style="{
              top: (draggingState.activeTableId === table.id ? draggingState.currentY : table.y) + 'px',
              left: (draggingState.activeTableId === table.id ? draggingState.currentX : table.x) + 'px',
              width: table.width + 'px',
              height: table.height + 'px',
              border: highlightSelection && table.table_id === props.selectedTableId ? '1px solid red' : ''
            }" @mousedown.stop="startDrag($event, table)" @touchstart.stop="startTouchDrag($event, table)"
            @click.stop="handleTableClick(table)">
            <div class="text-center unselectable"
              style="margin: auto; max-height: 100%; width: 100%; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: flex-start;">
              <div class="text-subtitle-2 font-weight-bold" style="font-size: 0.8rem">{{ table.name || table.table_name
                || table.master_table_name }}</div>
              <div v-if="types && table.inUse">
                <SubTypeSummary :items="table.items" :types="types" />
              </div>
              <div v-else class="text-caption" style="font-size: 0.6rem">{{ table.default_seats }}p</div>
            </div>
          </div>
        </div>
      </div>
      <div v-else-if="room && room.id === 0" style="width: 100%">
        <v-container>
          <v-row justify="center">
            <v-col v-for="table in activeTables" cols="12" sm="6" md="4" lg="3" xl="2">
              <v-card :style="{
                border: highlightSelection && table.table_id === props.selectedTableId ? '1px solid red' : ''
              }" style="padding: 10px; text-align: center" @click.stop="handleTableClick(table)">
                <v-card-title>
                  {{ table.table_name }}
                </v-card-title>
                <v-card-text v-if="types">
                  <SubTypeSummary :items="table.items" :types="types" />
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </v-container>
      </div>
      <v-alert v-else type="info" variant="tonal" class="ma-auto" style="max-width: 400px">
        Nessuna sala selezionata.
      </v-alert>
    </div>
  </div>
</template>

<style scoped>
.viewport-scroller {
  width: 100%;
  height: 100%;
  overflow: auto;
  display: flex;
  position: relative
}

.canvas-centering-wrapper {
  margin: auto;
  padding: 20px;
  min-width: min-content;
  min-height: min-content;
  display: flex;
  justify-content: center;
  align-items: center
}

.room-scaler {
  position: relative
}

.room-floor {
  position: absolute;
  top: 0;
  left: 0;
  overflow: hidden;
  transform-origin: 0 0;
  will-change: transform;
  background-color: #ffffff;
  background-image:
    linear-gradient(#e5e5e5 1px, transparent 1px),
    linear-gradient(90deg, #e5e5e5 1px, transparent 1px);
  background-size: 50px 50px;
  background-repeat: repeat !important;
}

.grid-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image:
    linear-gradient(#e0e0e0 1px, transparent 1px),
    linear-gradient(90deg, #e0e0e0 1px, transparent 1px);
  background-size: 50px 50px;
  opacity: 0.5;
  pointer-events: none
}

.table-item {
  position: absolute;
  background-color: #fff;
  user-select: none;
  transition: box-shadow 0.1s;
  touch-action: none;
  will-change: top, left
}

.is-dragging {
  z-index: 100;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3) !important
}

.in-use {
  border: 2px solid #007bff;
  box-shadow: inset 0 0 10px rgba(0, 123, 255, 0.2);
}

.table-item.cursor-grab:active {
  cursor: grabbing
}

.ring-active {
  box-shadow: 0 0 0 3px #1976D2 !important;
  border-color: #1565C0
}

.unselectable {
  user-select: none;
  pointer-events: none
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(33, 150, 243, 0.4)
  }

  70% {
    box-shadow: 0 0 0 10px rgba(33, 150, 243, 0)
  }

  100% {
    box-shadow: 0 0 0 0 rgba(33, 150, 243, 0)
  }
}
</style>