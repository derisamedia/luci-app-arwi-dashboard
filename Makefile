include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-arwi-dashboard
PKG_VERSION:=1.1
PKG_RELEASE:=1

PKG_MAINTAINER:=Derisamedia
PKG_LICENSE:=Apache-2.0

LUCI_TITLE:=LuCI Support for Arwi Dashboard
LUCI_DEPENDS:=+luci-base
LUCI_PKGARCH:=all

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
