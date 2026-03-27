/**
 * @condrix/client-components
 *
 * Shared UI components and design system for Condrix clients.
 */

// Utilities
export { cn } from './lib/utils.js';

// Design tokens
export { spacing, fontSize, radius, transition } from './tokens.js';

// Primitives
export { Button, type ButtonProps } from './button.js';
export { Input, type InputProps } from './input.js';
export { Textarea, type TextareaProps } from './textarea.js';
export { Select, type SelectProps } from './select.js';
export { Checkbox, type CheckboxProps } from './checkbox.js';
export { Badge, type BadgeProps } from './badge.js';
export { Spinner, type SpinnerProps } from './spinner.js';
export { Dialog, type DialogProps } from './dialog.js';
export { EmptyState, type EmptyStateProps } from './empty-state.js';
export {
  Tabs,
  TabList,
  Tab,
  TabPanel,
  type TabsProps,
  type TabListProps,
  type TabProps,
  type TabPanelProps,
} from './tabs.js';
export { FormGroup, type FormGroupProps } from './form-group.js';
export { Divider, type DividerProps } from './divider.js';
export { IconButton, type IconButtonProps } from './icon-button.js';
export {
  DropdownMenu,
  type DropdownMenuProps,
  type DropdownMenuItem,
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItemComponent,
  DropdownMenuSeparator,
} from './dropdown-menu.js';
export {
  Tooltip,
  type TooltipProps,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
  TooltipContent,
} from './tooltip.js';

// Layout + composite components
export { AppLayout, type AppLayoutProps } from './app-layout.js';
export { CoreTreeSidebar, type CoreTreeSidebarProps } from './core-tree-sidebar.js';
export { FolderBrowser, type FolderBrowserProps } from './folder-browser.js';
export { AddProjectDialog, type AddProjectDialogProps } from './add-project-dialog.js';
export { TitleBar, type TitleBarProps } from './title-bar.js';

// Settings components
export { CoresSettingsTab, type CoresSettingsTabProps } from './cores-settings-tab.js';
export { AiSettingsTab, type AiSettingsTabProps } from './ai-settings-tab.js';
export { AuthenticationSettingsTab } from './authentication-settings-tab.js';
export { MaestroLoginDialog, type MaestroLoginDialogProps } from './maestro-login-dialog.js';

// Reusable settings sub-components
export { AuthConfigSection, type AuthConfigSectionProps } from './auth-config-section.js';
export { CoreCard, type CoreCardProps } from './core-card.js';
export { CoreAddForm, type CoreAddFormProps } from './core-add-form.js';
export { CollapsibleSection, type CollapsibleSectionProps } from './collapsible-section.js';

// Legacy — kept for backward compat until all consumers migrate
export { WorkspaceSidebar, type WorkspaceSidebarProps } from './workspace-sidebar.js';

// shadcn/ui component library
export * from './ui/index.js';
