"use client"

import * as React from "react"
import { XIcon } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  placement = "center",
  sheetSnap = false,
  style,
  ref,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
  placement?: "center" | "responsive-sheet"
  /** Utility sheets may expand; input sheets retain viewport-aware sizing. */
  sheetSnap?: boolean
}) {
  const [drag, setDrag] = React.useState(0)
  const [dragging, setDragging] = React.useState(false)
  const [expanded, setExpanded] = React.useState(false)
  const closeRef = React.useRef<HTMLButtonElement>(null)
  const returnFocus = React.useRef<HTMLElement | null>(null)
  const gesture = React.useRef<{ id: number; y: number; time: number; moved: boolean } | null>(null)
  const suppressClick = React.useRef(false)
  const isSheet = placement === "responsive-sheet"
  const canGesture = () => isSheet && showCloseButton && window.matchMedia("(max-width: 767px)").matches
  const reset = () => { gesture.current = null; setDragging(false); setDrag(0) }
  const dismiss = () => {
    // Controlled dialogs can reject the normal Radix close request while saving.
    closeRef.current?.click()
    reset()
  }
  const onHandleDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!canGesture() || event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    gesture.current = { id: event.pointerId, y: event.clientY, time: performance.now(), moved: false }
    suppressClick.current = false
    setDragging(true)
  }
  const onHandleMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const start = gesture.current
    if (!start || start.id !== event.pointerId) return
    const distance = event.clientY - start.y
    if (Math.abs(distance) > 8) start.moved = true
    setDrag(Math.max(sheetSnap ? -40 : 0, Math.min(260, distance)))
  }
  const onHandleUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const start = gesture.current
    if (!start || start.id !== event.pointerId) return
    const distance = event.clientY - start.y
    const velocity = distance / Math.max(1, performance.now() - start.time)
    suppressClick.current = start.moved
    if (distance > 96 || distance > 40 && velocity > .7) {
      if (sheetSnap && expanded) { setExpanded(false); reset() }
      else dismiss()
    } else {
      if (sheetSnap && distance < -24) setExpanded(true)
      reset()
    }
  }
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        data-slot="dialog-content"
        data-sheet={isSheet || undefined}
        data-sheet-snap={isSheet && sheetSnap || undefined}
        data-sheet-expanded={expanded || undefined}
        data-sheet-dragging={dragging || undefined}
        style={{ ...style, "--sheet-drag": `${drag}px` } as React.CSSProperties}
        className={cn(
          "fixed z-50 grid gap-4 rounded-lg border bg-background p-6 shadow-lg outline-none",
          placement === "center" && "top-[50%] left-[50%] w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:max-w-lg",
          className
        )}
        {...props}
        onOpenAutoFocus={event => {
          returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
          props.onOpenAutoFocus?.(event)
        }}
        onCloseAutoFocus={event => {
          props.onCloseAutoFocus?.(event)
          if (!event.defaultPrevented && returnFocus.current?.isConnected) {
            event.preventDefault()
            returnFocus.current.focus({ preventScroll: true })
          }
        }}
        onEscapeKeyDown={event => {
          props.onEscapeKeyDown?.(event)
          // Radix listens on document capture, before the combobox's own handler.
          // Escape closes suggestions first, and the sheet on the next press.
          if (document.activeElement?.matches('[role=combobox][aria-expanded=true]')) event.preventDefault()
        }}
      >
        {isSheet && <button
          type="button"
          className="sheet-drag-handle"
          data-sheet-handle=""
          disabled={!showCloseButton}
          aria-label={sheetSnap ? expanded ? "シートを小さくする" : "シートを広げる" : "シートを閉じる（下にドラッグでも閉じる）"}
          aria-expanded={sheetSnap ? expanded : undefined}
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={reset}
          onLostPointerCapture={() => { if (gesture.current) reset() }}
          onClick={event => {
            if (suppressClick.current) { event.preventDefault(); suppressClick.current = false; return }
            if (sheetSnap) setExpanded(value => !value)
            else dismiss()
          }}
          onKeyDown={event => {
            if (sheetSnap && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
              event.preventDefault()
              setExpanded(event.key === "ArrowUp")
            }
          }}
        ><span aria-hidden="true" /></button>}
        {children}
        <DialogPrimitive.Close ref={closeRef} className="sheet-programmatic-close" tabIndex={-1} aria-hidden="true" />
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
