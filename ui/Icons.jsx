import {
  ArrowLeft,
  ArrowUpRight,
  Chat,
  Check,
  ChevronDown,
  ChevronRight,
  Code,
  Copy,
  DotsHorizontalMoreMenu,
  Download,
  Expand,
  Eye,
  FileDocument,
  Reload,
  Share,
  Trash,
  X,
} from '@openai/apps-sdk-ui/components/Icon'

function AppIcon({ icon: Icon, size = 20, ...props }) {
  return <Icon width={size} height={size} aria-hidden="true" {...props} />
}

export const ArtifactIcon = (props) => <AppIcon icon={FileDocument} {...props} />
export const ArrowLeftIcon = (props) => <AppIcon icon={ArrowLeft} {...props} />
export const ArrowUpRightIcon = (props) => <AppIcon icon={ArrowUpRight} {...props} />
export const ChatIcon = (props) => <AppIcon icon={Chat} {...props} />
export const ChevronDownIcon = (props) => <AppIcon icon={ChevronDown} {...props} />
export const ChevronRightIcon = (props) => <AppIcon icon={ChevronRight} {...props} />
export const CopyIcon = (props) => <AppIcon icon={Copy} {...props} />
export const CodeIcon = (props) => <AppIcon icon={Code} {...props} />
export const DownloadIcon = (props) => <AppIcon icon={Download} {...props} />
export const ExpandIcon = (props) => <AppIcon icon={Expand} {...props} />
export const MoreIcon = (props) => <AppIcon icon={DotsHorizontalMoreMenu} {...props} />
export const EyeIcon = (props) => <AppIcon icon={Eye} {...props} />
export const ReloadIcon = (props) => <AppIcon icon={Reload} {...props} />
export const ShareIcon = (props) => <AppIcon icon={Share} {...props} />
export const TrashIcon = (props) => <AppIcon icon={Trash} {...props} />
export const CheckIcon = (props) => <AppIcon icon={Check} {...props} />
export const CloseIcon = (props) => <AppIcon icon={X} {...props} />
