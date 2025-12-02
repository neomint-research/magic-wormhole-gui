!macro customHeader
  !include "MUI2.nsh"
  Var IsPortable
  Var PortableMode
!macroend

!macro customPageAfterChangeDir
  ; Custom page for installation mode selection
  Page custom PortableModePageCreate PortableModePageLeave
!macroend

Function PortableModePageCreate
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 24u "Choose installation type:"
  Pop $0

  ${NSD_CreateRadioButton} 20u 30u 100% 12u "Standard Installation"
  Pop $1
  ${NSD_SetState} $1 ${BST_CHECKED}

  ${NSD_CreateLabel} 35u 44u 100% 20u "Installs to Program Files with Start Menu shortcuts.$\nRequires uninstallation to remove."
  Pop $0

  ${NSD_CreateRadioButton} 20u 70u 100% 12u "Portable Installation"
  Pop $PortableMode

  ${NSD_CreateLabel} 35u 84u 100% 20u "Extracts to chosen folder. No registry entries.$\nDelete folder to remove. Settings stored locally."
  Pop $0

  nsDialogs::Show
FunctionEnd

Function PortableModePageLeave
  ${NSD_GetState} $PortableMode $IsPortable
FunctionEnd

!macro customInstall
  ${If} $IsPortable == ${BST_CHECKED}
    ; Create portable marker file
    FileOpen $0 "$INSTDIR\.portable" w
    FileWrite $0 "This is a portable installation."
    FileClose $0
    
    ; Create local data directory for portable mode
    CreateDirectory "$INSTDIR\data"
  ${EndIf}
!macroend

!macro customUnInstall
  ; Clean up portable marker if exists
  Delete "$INSTDIR\.portable"
  RMDir "$INSTDIR\data"
!macroend
