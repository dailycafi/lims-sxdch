import { Dialog, DialogTitle, DialogBody, DialogActions } from '@/components/dialog'
import { Button } from '@/components/button'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import type { UnsavedChangesAction } from '@/types/tabs'

interface UnsavedChangesDialogProps {
  isOpen: boolean
  onAction: (action: UnsavedChangesAction) => void
  tabTitle: string
}

/**
 * 未保存更改确认对话框
 * 当用户尝试关闭含有未保存更改的 Tab 时显示
 */
export function UnsavedChangesDialog({
  isOpen,
  onAction,
  tabTitle,
}: UnsavedChangesDialogProps) {
  return (
    <Dialog open={isOpen} onClose={() => onAction('cancel')} size="sm">
      <div className="flex items-center justify-center mb-4">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30">
          <ExclamationTriangleIcon className="w-6 h-6 text-amber-600 dark:text-amber-500" />
        </div>
      </div>

      <DialogTitle>有未保存的更改</DialogTitle>

      <DialogBody>
        <p className="text-sm text-center text-zinc-600 dark:text-zinc-400">
          「{tabTitle}」中有未保存的更改。关闭前是否保存？
        </p>
      </DialogBody>

      <DialogActions>
        <Button
          plain
          onClick={() => onAction('cancel')}
        >
          取消
        </Button>
        <Button
          color="red"
          onClick={() => onAction('discard')}
        >
          放弃更改
        </Button>
        <Button
          color="blue"
          onClick={() => onAction('save')}
        >
          保存并关闭
        </Button>
      </DialogActions>
    </Dialog>
  )
}
