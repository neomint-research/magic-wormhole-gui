; Wormhole Desktop NSIS Installer Customizations
; ============================================
; Handles: Fresh install, Update, Repair, Uninstall scenarios

!include "MUI2.nsh"
!include "nsDialogs.nsh"

; --------------------------------------------
; Variables
; --------------------------------------------
Var ExistingVersion
Var ExistingInstallDir
Var InstallMode

; --------------------------------------------
; Pre-Init: Check for existing installation
; --------------------------------------------
!macro preInit
  ; Check both registry views for existing installation
  SetRegView 64
  ReadRegStr $ExistingVersion HKCU "${INSTALL_REGISTRY_KEY}" "DisplayVersion"
  ReadRegStr $ExistingInstallDir HKCU "${INSTALL_REGISTRY_KEY}" "InstallLocation"
  
  ${If} $ExistingVersion == ""
    ReadRegStr $ExistingVersion HKLM "${INSTALL_REGISTRY_KEY}" "DisplayVersion"
    ReadRegStr $ExistingInstallDir HKLM "${INSTALL_REGISTRY_KEY}" "InstallLocation"
  ${EndIf}
  
  SetRegView 32
  ${If} $ExistingVersion == ""
    ReadRegStr $ExistingVersion HKCU "${INSTALL_REGISTRY_KEY}" "DisplayVersion"
    ReadRegStr $ExistingInstallDir HKCU "${INSTALL_REGISTRY_KEY}" "InstallLocation"
  ${EndIf}
  
  ${If} $ExistingVersion == ""
    ReadRegStr $ExistingVersion HKLM "${INSTALL_REGISTRY_KEY}" "DisplayVersion"
    ReadRegStr $ExistingInstallDir HKLM "${INSTALL_REGISTRY_KEY}" "InstallLocation"
  ${EndIf}
!macroend

; --------------------------------------------
; Custom Init: Show mode selection if existing
; --------------------------------------------
!macro customInit
  ${If} $ExistingVersion != ""
    MessageBox MB_YESNOCANCEL|MB_ICONQUESTION \
      "Wormhole Desktop $ExistingVersion is already installed.$\r$\n$\r$\n\
      Do you want to upgrade to version ${VERSION}?$\r$\n$\r$\n\
      Yes = Upgrade (keep settings)$\r$\n\
      No = Uninstall existing version$\r$\n\
      Cancel = Exit installer" \
      IDYES upgrade IDNO uninstall
    
    ; Cancel was clicked
    Abort
    
    upgrade:
      StrCpy $InstallMode "upgrade"
      ${If} $ExistingInstallDir != ""
        StrCpy $INSTDIR $ExistingInstallDir
      ${EndIf}
      Goto done
    
    uninstall:
      StrCpy $InstallMode "uninstall"
      ; Execute uninstaller silently
      ${If} $ExistingInstallDir != ""
        ExecWait '"$ExistingInstallDir\Uninstall Wormhole Desktop.exe" /S _?=$ExistingInstallDir'
        ; Clear the existing version after uninstall
        StrCpy $ExistingVersion ""
      ${EndIf}
      Goto done
    
    done:
  ${Else}
    StrCpy $InstallMode "fresh"
  ${EndIf}
!macroend

; --------------------------------------------
; Custom Install: Post-installation tasks
; --------------------------------------------
!macro customInstall
  ; Log installation mode for debugging
  DetailPrint "Installation mode: $InstallMode"
  DetailPrint "Installed version: ${VERSION}"
!macroend

; --------------------------------------------
; Custom Uninstall: Cleanup tasks
; --------------------------------------------
!macro customUnInstall
  ; Remove app data if user chose to delete on uninstall
  ; (handled by deleteAppDataOnUninstall in electron-builder config)
!macroend
